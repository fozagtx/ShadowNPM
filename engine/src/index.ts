import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

import { createPublicClient, http, defineChain, parseAbi } from "viem";

import { config } from "./config.js";
import { runAudit } from "./pipeline.js";
import { publishAuditResults } from "./publish.js";
import { createSession, getSession, finalizeSession, createEmitFn, type AuditEvent } from "./events.js";
import { cleanupPackage } from "./phases/resolve.js";

const app = new Hono();

// Enable CORS for frontend dev server
app.use("/*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Payment config — simple USDC transfer verification on Arc testnet
// ---------------------------------------------------------------------------

const PAYMENT_ENABLED = !!config.payeeAddress;
const ARC_CHAIN_ID = 5042002;
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_USDC_DECIMALS = 18;
// $0.001 = 0.001 * 10^18 = 1e15
const AUDIT_PRICE_WEI = BigInt(1e15);

const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});

const arcPublicClient = PAYMENT_ENABLED
  ? createPublicClient({ chain: arcTestnet, transport: http() })
  : null;

// Track verified tx hashes to prevent replay
const verifiedTxHashes = new Set<string>();

async function verifyPaymentTx(txHash: string): Promise<boolean> {
  if (!arcPublicClient || !config.payeeAddress) return false;
  if (verifiedTxHashes.has(txHash)) return false; // replay protection

  try {
    // Wait for tx to be mined (retry up to 30s)
    let receipt;
    for (let i = 0; i < 15; i++) {
      try {
        receipt = await arcPublicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        break;
      } catch {
        // tx not mined yet — wait 2s and retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!receipt) {
      console.log(`[payment] Tx ${txHash} not mined after 30s`);
      return false;
    }
    if (receipt.status !== "success") {
      console.log(`[payment] Tx ${txHash} reverted`);
      return false;
    }

    console.log(`[payment] Tx ${txHash} has ${receipt.logs.length} logs`);

    // Check for USDC Transfer event to payee with sufficient amount
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const payeePadded = `0x000000000000000000000000${config.payeeAddress!.slice(2).toLowerCase()}`;

    for (const log of receipt.logs) {
      console.log(`[payment] Log: addr=${log.address} topics=${JSON.stringify(log.topics)} data=${log.data}`);
      if (
        log.address.toLowerCase() === ARC_USDC.toLowerCase() &&
        log.topics[0] === transferTopic &&
        log.topics[2]?.toLowerCase() === payeePadded
      ) {
        const amount = BigInt(log.data);
        if (amount >= AUDIT_PRICE_WEI) {
          verifiedTxHashes.add(txHash);
          console.log(`[payment] Verified! amount=${amount}`);
          return true;
        }
        console.log(`[payment] Amount too low: ${amount} < ${AUDIT_PRICE_WEI}`);
      }
    }
    console.log(`[payment] No matching Transfer log found`);
    return false;
  } catch (err) {
    console.error(`[payment] Error verifying tx:`, err);
    return false;
  }
}

if (PAYMENT_ENABLED) {
  console.log(`[payment] Audits cost $0.001 USDC on Arc testnet`);
  console.log(`[payment] Payee: ${config.payeeAddress}`);
} else {
  console.log("[payment] No SHADOWNPM_PAYEE_ADDRESS set — audits are free");
}

const AuditRequest = z.object({
  packageName: z.string().min(1),
  version: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Audit queue — one audit at a time, prevents rate limiting & resource exhaustion
// ---------------------------------------------------------------------------

type QueueItem = { packageName: string; version?: string; resolve: (v: any) => void; reject: (e: any) => void };
const auditQueue: QueueItem[] = [];
let auditRunning = false;

async function processQueue() {
  if (auditRunning || auditQueue.length === 0) return;
  auditRunning = true;
  const item = auditQueue.shift()!;
  console.log(`[queue] starting ${item.packageName} (${auditQueue.length} queued)`);

  try {
    const { report, packagePath, cleanup } = await runAudit(item.packageName);

    // Publish to IPFS + ENS for all verdicts
    if (process.env.PINATA_JWT) {
      // Try to read version from the audited package.json
      let resolvedVersion = item.version || "latest";
      try {
        const pkgJson = JSON.parse(fs.readFileSync(path.join(packagePath, "package.json"), "utf-8"));
        if (pkgJson.version) resolvedVersion = pkgJson.version;
      } catch { /* use fallback */ }

      publishAuditResults(item.packageName, resolvedVersion, report, packagePath)
        .then((pub) => console.log(`[publish] done: report=${pub.reportCid} source=${pub.sourceCid} ens=${pub.ensName ?? "skipped"}`))
        .catch((err) => console.error("[publish] failed:", err instanceof Error ? err.message : err))
        .finally(cleanup);
    } else {
      cleanup();
    }

    item.resolve(report);
  } catch (err) {
    item.reject(err);
  } finally {
    auditRunning = false;
    processQueue();
  }
}

function enqueueAudit(packageName: string, version?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    auditQueue.push({ packageName, version, resolve, reject });
    processQueue();
  });
}

// ---------------------------------------------------------------------------
// GET /payment-info — tells frontend what to pay
// ---------------------------------------------------------------------------

app.get("/payment-info", (c) => {
  if (!PAYMENT_ENABLED) {
    return c.json({ required: false });
  }
  return c.json({
    required: true,
    chainId: ARC_CHAIN_ID,
    token: ARC_USDC,
    decimals: ARC_USDC_DECIMALS,
    amount: AUDIT_PRICE_WEI.toString(),
    payTo: config.payeeAddress,
    rpc: "https://rpc.testnet.arc.network",
  });
});

// ---------------------------------------------------------------------------
// POST /verify-payment — verifies a tx hash, returns a one-time token
// ---------------------------------------------------------------------------

const paymentTokens = new Map<string, number>(); // token -> expiry timestamp

app.post("/verify-payment", async (c) => {
  if (!PAYMENT_ENABLED) {
    // No payment needed — return a free token
    const token = crypto.randomUUID();
    paymentTokens.set(token, Date.now() + 5 * 60 * 1000);
    return c.json({ verified: true, token });
  }

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const txHash = body?.txHash;
  if (!txHash || typeof txHash !== "string") {
    return c.json({ error: "txHash required" }, 400);
  }

  const valid = await verifyPaymentTx(txHash);
  if (!valid) {
    return c.json({ error: "Payment not verified. Check tx hash and try again." }, 400);
  }

  const token = crypto.randomUUID();
  paymentTokens.set(token, Date.now() + 5 * 60 * 1000); // 5 min expiry
  console.log(`[payment] Verified tx ${txHash}`);
  return c.json({ verified: true, token });
});

function consumePaymentToken(token: string | null | undefined): boolean {
  if (!PAYMENT_ENABLED) return true;
  if (!token) return false;
  const expiry = paymentTokens.get(token);
  if (!expiry || Date.now() > expiry) {
    paymentTokens.delete(token!);
    return false;
  }
  paymentTokens.delete(token);
  return true;
}

// ---------------------------------------------------------------------------
// POST /audit — sync, waits for result
// ---------------------------------------------------------------------------

app.post("/audit", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = AuditRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.format() }, 400);
  }

  try {
    const report = await enqueueAudit(parsed.data.packageName, parsed.data.version);
    return c.json(report);
  } catch (err) {
    console.error("[api] audit failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Audit failed", message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Streaming audit endpoints
// ---------------------------------------------------------------------------

// Start audit asynchronously, returns auditId for SSE streaming
app.post("/audit/stream", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = AuditRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.format() }, 400);
  }

  // Verify payment token
  const paymentToken = (body as any)?.paymentToken;
  if (!consumePaymentToken(paymentToken)) {
    return c.json({ error: "Payment required. Complete payment first." }, 403);
  }

  const session = createSession(parsed.data.packageName);
  const emit = createEmitFn(session.auditId, session.emitter);

  // Run audit in background — don't await
  runAudit(parsed.data.packageName, emit, session.auditId)
    .then(({ report, packagePath, cleanup }) => {
      finalizeSession(session.auditId, report);

      // Publish to IPFS + ENS for all verdicts
      if (process.env.PINATA_JWT) {
        let resolvedVersion = parsed.data.version || "latest";
        try {
          const pkgJson = JSON.parse(fs.readFileSync(path.join(packagePath, "package.json"), "utf-8"));
          if (pkgJson.version) resolvedVersion = pkgJson.version;
        } catch { /* use fallback */ }

        publishAuditResults(parsed.data.packageName, resolvedVersion, report, packagePath)
          .then((pub) => {
            console.log(`[publish] done: report=${pub.reportCid} source=${pub.sourceCid} ens=${pub.ensName ?? "skipped"}`);
            emit("publish_complete", { reportCid: pub.reportCid, sourceCid: pub.sourceCid, ensName: pub.ensName });
          })
          .catch((err) => {
            console.error("[publish] failed:", err instanceof Error ? err.message : err);
            emit("publish_failed", { error: err instanceof Error ? err.message : "unknown" });
          })
          .finally(cleanup);
      } else {
        cleanup();
      }
    })
    .catch((err) => {
      console.error("[api] streaming audit failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      emit("audit_error", { error: message });
      finalizeSession(session.auditId, null, message);
    });

  return c.json({ auditId: session.auditId });
});

// SSE event stream for a running audit
app.get("/audit/:id/events", (c) => {
  const auditId = c.req.param("id");
  const session = getSession(auditId);
  if (!session) {
    return c.json({ error: "Audit session not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    let eventId = 0;

    // Replay all buffered events so late-connecting clients catch up
    for (const event of session.eventBuffer) {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
          id: String(eventId++),
        });
      } catch { break; }
    }

    // If audit already finished, we're done after replay
    if (session.status !== "running") {
      return;
    }

    const handler = async (event: AuditEvent) => {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
          id: String(eventId++),
        });
      } catch {
        // Client disconnected
      }
    };

    session.emitter.on("event", handler);

    // Wait until audit completes or client disconnects
    await new Promise<void>((resolve) => {
      const done = () => {
        session.emitter.off("event", handler);
        resolve();
      };

      // Listen for terminal events
      const terminalHandler = (event: AuditEvent) => {
        if (event.type === "verdict_reached" || event.type === "audit_error") {
          // Give a moment for the event to be sent
          setTimeout(done, 100);
        }
      };
      session.emitter.on("event", terminalHandler);

      stream.onAbort(() => {
        session.emitter.off("event", terminalHandler);
        done();
      });
    });
  });
});

// Serve raw file content from a running audit's package
app.get("/audit/:id/file/*", (c) => {
  const auditId = c.req.param("id");
  const session = getSession(auditId);
  if (!session) {
    return c.json({ error: "Audit session not found" }, 404);
  }
  if (!session.packagePath) {
    return c.json({ error: "Package not yet resolved" }, 404);
  }

  const filePath = c.req.path.replace(`/audit/${auditId}/file/`, "");
  const absPath = path.join(session.packagePath, filePath);

  // Security: ensure path stays within package directory
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(path.resolve(session.packagePath))) {
    return c.json({ error: "Path traversal denied" }, 403);
  }

  try {
    const content = fs.readFileSync(resolved, "utf-8");
    return c.text(content);
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

// Get final report for a completed audit
app.get("/audit/:id/report", (c) => {
  const auditId = c.req.param("id");
  const session = getSession(auditId);
  if (!session) {
    return c.json({ error: "Audit session not found" }, 404);
  }
  if (session.status === "running") {
    return c.json({ status: "running" }, 202);
  }
  if (session.report) {
    return c.json(session.report);
  }
  return c.json({ error: "Audit failed" }, 500);
});

app.get("/health", (c) => c.json({ status: "ok" }));

// ---------------------------------------------------------------------------
// /api/* mirror — so frontend can use /api prefix in both dev and production
// ---------------------------------------------------------------------------
app.all("/api/*", async (c) => {
  const newPath = c.req.path.replace(/^\/api/, "") || "/";
  const url = new URL(c.req.url);
  url.pathname = newPath;
  const newReq = new Request(url.toString(), c.req.raw);
  return app.fetch(newReq, c.env);
});

// ---------------------------------------------------------------------------
// Static file serving — frontend dist (production)
// ---------------------------------------------------------------------------
const frontendDist = path.resolve(import.meta.dirname, "../../frontend/dist");

if (fs.existsSync(frontendDist)) {
  console.log(`[static] Serving frontend from ${frontendDist}`);

  app.use(
    "/*",
    serveStatic({
      root: path.relative(process.cwd(), frontendDist),
    }),
  );

  // SPA fallback — serve index.html for non-API, non-file routes
  app.get("/*", (c) => {
    const indexPath = path.join(frontendDist, "index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    return c.html(html);
  });
} else {
  console.log(`[static] No frontend build found at ${frontendDist} — API-only mode`);
}

console.log(`ShadowNPM Engine starting on ${config.apiHost}:${config.apiPort}`);
serve({ fetch: app.fetch, hostname: config.apiHost, port: config.apiPort });
