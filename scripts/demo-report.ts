/**
 * Reads demo-results.json and generates a markdown report.
 *
 * Usage:
 *   npx tsx scripts/demo-report.ts [--input <path>] [--output <path>]
 *
 * Defaults:
 *   --input  scripts/demo-results.json
 *   --output scripts/demo-report.md
 */

import * as fs from "fs";
import * as path from "path";

/* ── CLI flags ─────────────────────────────────────────────────────── */

function parseArgs(argv: string[]) {
  const flags = {
    input: "scripts/demo-results.json",
    output: "scripts/demo-report.md",
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--input":
        flags.input = argv[++i];
        break;
      case "--output":
        flags.output = argv[++i];
        break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
  }
  return flags;
}

const flags = parseArgs(process.argv);

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

/* ── Main ──────────────────────────────────────────────────────────── */

function main() {
  const inputPath = path.resolve(flags.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Results file not found: ${inputPath}`);
    console.error("Run the demo first: npx tsx scripts/demo-50tx.ts");
    process.exit(1);
  }

  const data: DemoResults = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  const successRate =
    data.totalRequests > 0
      ? ((data.successful / data.totalRequests) * 100).toFixed(1)
      : "0.0";

  const priceNum = parseFloat(data.pricePerAudit.replace("$", ""));
  const totalSpent = (data.successful * priceNum).toFixed(3);

  const explorerBase = "https://testnet.arcscan.io";

  const lines: string[] = [];

  lines.push("# ShadowNPM x402 Nanopayment Demo Report");
  lines.push("");
  lines.push(`> Generated from \`${flags.input}\` on ${new Date().toISOString()}`);
  lines.push("");

  /* ── Summary ─────────────────────────────────────────────────────── */

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Timestamp | ${data.timestamp} |`);
  lines.push(`| Wallet | \`${data.wallet}\` |`);
  lines.push(`| Network | ${data.network} |`);
  lines.push(`| Price per audit | ${data.pricePerAudit} USDC |`);
  lines.push(`| Total requests | ${data.totalRequests} |`);
  lines.push(`| Successful | ${data.successful} |`);
  lines.push(`| Failed | ${data.failed} |`);
  lines.push(`| Success rate | ${successRate}% |`);
  lines.push(`| Total USDC spent | $${totalSpent} |`);
  lines.push("");

  /* ── Cost comparison ─────────────────────────────────────────────── */

  lines.push("## Cost Comparison");
  lines.push("");
  lines.push("Cost to run the same audit volume across different networks:");
  lines.push("");

  const txCount = data.successful;
  const arcGas = 0; // x402 covers gas
  const l2Gas = 0.00005; // typical L2 gas per tx
  const l1Gas = 0.005; // typical L1 gas per tx

  lines.push("| Network | Payment per audit | Gas per tx (est.) | Total cost |");
  lines.push("|---------|-------------------|-------------------|------------|");
  lines.push(
    `| **Arc Testnet (x402)** | ${data.pricePerAudit} | ~$0.000 (covered) | **$${totalSpent}** |`,
  );
  lines.push(
    `| L2 (Base/Optimism) | ${data.pricePerAudit} | ~$${l2Gas.toFixed(5)} | $${(txCount * (priceNum + l2Gas)).toFixed(3)} |`,
  );
  lines.push(
    `| L1 (Ethereum) | ${data.pricePerAudit} | ~$${l1Gas.toFixed(3)} | $${(txCount * (priceNum + l1Gas)).toFixed(3)} |`,
  );
  lines.push("");

  /* ── Transaction table ───────────────────────────────────────────── */

  lines.push("## Transactions");
  lines.push("");
  lines.push("| # | Package | Status | Tx Hash | Timestamp |");
  lines.push("|---|---------|--------|---------|-----------|");

  data.transactions.forEach((tx, i) => {
    const num = (i + 1).toString();
    const statusStr = tx.error ? `err: ${tx.error}` : tx.status.toString();
    const txLink = tx.txHash
      ? `[${tx.txHash.slice(0, 10)}...](${explorerBase}/tx/${tx.txHash})`
      : "-";
    const ts = tx.timestamp ? tx.timestamp.replace("T", " ").slice(0, 19) : "-";
    lines.push(`| ${num} | ${tx.package} | ${statusStr} | ${txLink} | ${ts} |`);
  });

  lines.push("");

  if (data.wallet && data.wallet !== "0x_DRY_RUN") {
    lines.push(
      `[View all transactions on Arc Explorer](${explorerBase}/address/${data.wallet})`,
    );
    lines.push("");
  }

  /* ── Write report ────────────────────────────────────────────────── */

  const outputPath = path.resolve(flags.output);
  fs.writeFileSync(outputPath, lines.join("\n"));

  console.log(`Report written to: ${outputPath}`);
  console.log(`  ${data.totalRequests} transactions, ${successRate}% success rate`);
}

main();
