import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

import { config } from "./config.js";
import { runAudit } from "./pipeline.js";
import { publishAuditResults } from "./publish.js";
import { createSession, getSession, finalizeSession, createEmitFn, type AuditEvent } from "./events.js";
import { cleanupPackage } from "./phases/resolve.js";

const app = new Hono();

// Enable CORS for frontend dev server
app.use("/*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Payment config
// ---------------------------------------------------------------------------

const PAYMENT_ENABLED = !!config.payeeAddress;

if (PAYMENT_ENABLED) {
  console.log(`[payment] Audits cost ${config.auditPriceUsd} USDC on Arc testnet`);
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
