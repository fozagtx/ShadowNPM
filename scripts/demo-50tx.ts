/**
 * Demo script: generates 50+ x402 USDC nanopayment transactions on Arc testnet.
 *
 * Usage:
 *   SHADOWNPM_PRIVATE_KEY=0x... npx tsx scripts/demo-50tx.ts
 *
 * Flags:
 *   --count N       Number of packages to audit (default: 55, the full list)
 *   --dry-run       Skip actual x402 payment, just log what would happen
 *   --output <path> Path to write results JSON (default: scripts/demo-results.json)
 *
 * Prerequisites:
 *   - Engine running at ENGINE_URL (default: http://localhost:8000)
 *   - Wallet funded with testnet USDC on Arc (https://faucet.arc.network)
 *   - SHADOWNPM_PRIVATE_KEY set to a funded wallet's private key
 */

/* ── CLI flag parsing ──────────────────────────────────────────────── */

function parseArgs(argv: string[]) {
  const flags = {
    count: 55,
    dryRun: false,
    output: "scripts/demo-results.json",
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--count":
        flags.count = parseInt(argv[++i], 10);
        if (Number.isNaN(flags.count) || flags.count < 1) {
          console.error("--count must be a positive integer");
          process.exit(1);
        }
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--output":
        flags.output = argv[++i];
        if (!flags.output) {
          console.error("--output requires a path");
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
  }
  return flags;
}

const flags = parseArgs(process.argv);

/* ── Imports ───────────────────────────────────────────────────────── */

import * as fs from "fs";
import * as path from "path";

/* ── Config ────────────────────────────────────────────────────────── */

const ENGINE_URL =
  process.env.SHADOWNPM_AUDIT_API_URL ?? "http://localhost:8000";
const PRIVATE_KEY = process.env.SHADOWNPM_PRIVATE_KEY;
const PRICE_PER_AUDIT = "$0.001";

if (!flags.dryRun && !PRIVATE_KEY) {
  console.error("Set SHADOWNPM_PRIVATE_KEY to a funded Arc testnet wallet");
  process.exit(1);
}

// 55 popular npm packages for the demo
const PACKAGES = [
  "lodash",       "express",   "react",      "axios",         "chalk",
  "commander",    "dotenv",    "uuid",        "moment",       "debug",
  "underscore",   "async",     "bluebird",    "request",      "minimist",
  "glob",         "mkdirp",    "rimraf",      "semver",       "yargs",
  "inquirer",     "ora",       "nanoid",      "zod",          "pino",
  "fastify",      "koa",       "hono",        "esbuild",      "vite",
  "typescript",   "eslint",    "prettier",    "jest",         "mocha",
  "chai",         "sinon",     "supertest",   "nodemon",      "pm2",
  "ws",           "socket.io", "cors",        "helmet",       "morgan",
  "jsonwebtoken", "bcrypt",    "passport",    "mongoose",     "sequelize",
  "redis",        "ioredis",   "pg",          "mysql2",       "better-sqlite3",
];

/* ── Types ─────────────────────────────────────────────────────────── */

interface TxRecord {
  package: string;
  status: number;
  txHash: string | null;
  timestamp: string;
  error?: string;
}

interface DemoResults {
  timestamp: string;
  wallet: string;
  network: string;
  pricePerAudit: string;
  totalRequests: number;
  successful: number;
  failed: number;
  transactions: TxRecord[];
}

/* ── Retry helper ──────────────────────────────────────────────────── */

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 2000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Only retry on network errors or 5xx — not 4xx client errors
      const isRetryable =
        !err.status || (err.status >= 500 && err.status < 600);
      if (!isRetryable || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  const packagesToAudit = PACKAGES.slice(0, flags.count);
  const walletAddress = flags.dryRun ? "0x_DRY_RUN" : await getWalletAddress();

  console.log(`\n=== ShadowNPM x402 Nanopayment Demo ===`);
  console.log(`Mode:    ${flags.dryRun ? "DRY RUN (no payments)" : "LIVE"}`);
  console.log(`Engine:  ${ENGINE_URL}`);
  console.log(`Wallet:  ${walletAddress}`);
  console.log(`Count:   ${packagesToAudit.length} packages`);
  console.log(`Output:  ${flags.output}\n`);

  const transactions: TxRecord[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < packagesToAudit.length; i++) {
    const pkg = packagesToAudit[i];
    const num = `[${(i + 1).toString().padStart(2)}/${packagesToAudit.length}]`;

    if (flags.dryRun) {
      console.log(`${num} ${pkg}: DRY RUN — would pay ${PRICE_PER_AUDIT} USDC and POST /audit`);
      transactions.push({
        package: pkg,
        status: 0,
        txHash: null,
        timestamp: new Date().toISOString(),
      });
      success++;
      continue;
    }

    try {
      const record = await withRetry(() => auditWithPayment(pkg, num));
      transactions.push(record);
      if (record.status >= 200 && record.status < 400) {
        success++;
      } else {
        failed++;
      }
    } catch (err: any) {
      console.error(`${num} ${pkg}: FAILED -- ${err.message}`);
      transactions.push({
        package: pkg,
        status: 0,
        txHash: null,
        timestamp: new Date().toISOString(),
        error: err.message,
      });
      failed++;
    }

    // Small delay to avoid overwhelming the engine
    if (!flags.dryRun) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  /* ── Write results JSON ──────────────────────────────────────────── */

  const results: DemoResults = {
    timestamp: new Date().toISOString(),
    wallet: walletAddress,
    network: "eip155:5042002",
    pricePerAudit: PRICE_PER_AUDIT,
    totalRequests: packagesToAudit.length,
    successful: success,
    failed,
    transactions,
  };

  const outputPath = path.resolve(flags.output);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2) + "\n");

  /* ── Summary ─────────────────────────────────────────────────────── */

  const totalSpent = flags.dryRun
    ? "$0.000"
    : `$${(success * 0.001).toFixed(3)}`;

  console.log(`\n=== Demo Results ===`);
  console.log(`Transactions: ${success}/${packagesToAudit.length} successful`);
  console.log(`Total USDC spent: ${totalSpent}`);
  console.log(`Results saved to: ${outputPath}`);
  if (!flags.dryRun) {
    console.log(
      `Explorer: https://testnet.arcscan.io/address/${walletAddress}`,
    );
  }
}

/* ── Wallet setup (lazy — only when not dry-run) ───────────────────── */

let _walletAddress: string | undefined;

async function getWalletAddress(): Promise<string> {
  if (_walletAddress) return _walletAddress;
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  _walletAddress = account.address;
  return _walletAddress;
}

async function auditWithPayment(pkg: string, num: string): Promise<TxRecord> {
  const { createPublicClient, http, defineChain } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402HTTPClient, x402Client } = await import("@x402/core/client");
  const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
  const { toClientEvmSigner } = await import("@x402/evm");

  const arcTestnet = defineChain({
    id: 5042002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
    testnet: true,
  });

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const httpClient = new x402HTTPClient(client);

  // First request — expect 402
  const res1 = await fetch(`${ENGINE_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageName: pkg }),
  });

  if (res1.status !== 402) {
    console.log(`${num} ${pkg}: status=${res1.status} (no payment needed)`);
    return {
      package: pkg,
      status: res1.status,
      txHash: null,
      timestamp: new Date().toISOString(),
    };
  }

  // Extract payment requirements and sign
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name: string) => res1.headers.get(name),
    await res1.json().catch(() => undefined),
  );

  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders =
    httpClient.encodePaymentSignatureHeader(paymentPayload);

  // Retry with payment
  const res2 = await fetch(`${ENGINE_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...paymentHeaders },
    body: JSON.stringify({ packageName: pkg }),
  });

  // Try to extract transaction hash from payment response header
  let txHash: string | null = null;
  const paymentResponse = res2.headers.get("payment-response");
  if (paymentResponse) {
    try {
      const parsed = JSON.parse(paymentResponse);
      txHash = parsed.txHash ?? parsed.transactionHash ?? null;
    } catch {
      // Header might be a raw tx hash
      if (paymentResponse.startsWith("0x")) {
        txHash = paymentResponse;
      }
    }
  }

  console.log(
    `${num} ${pkg}: paid & submitted (status=${res2.status}${txHash ? `, tx=${txHash}` : ""})`,
  );

  return {
    package: pkg,
    status: res2.status,
    txHash,
    timestamp: new Date().toISOString(),
  };
}

main().catch(console.error);
