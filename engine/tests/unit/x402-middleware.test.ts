import test from "node:test";
import assert from "node:assert/strict";

import { Hono } from "hono";
import { withPatchedEnv } from "../helpers/env.ts";

/**
 * These tests verify the engine's conditional middleware behavior:
 * - When no SHADOWNPM_PAYEE_ADDRESS is set, /audit operates in free mode (no 402)
 * - Health endpoint always returns 200 regardless of payment config
 *
 * We build a minimal Hono app that replicates the conditional logic from index.ts
 * rather than importing the full app (which starts the server and has heavy deps).
 */

function createTestApp(payeeAddress?: string) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/audit", async (c) => {
    // Replicate the conditional payment check from index.ts
    if (payeeAddress) {
      // In the real app, x402 middleware or on-chain check would gate this.
      // Here we simulate the 402 response for paid mode.
      return c.json({ error: "Payment required" }, 402);
    }

    // Free mode — no payment needed
    return c.json({ status: "accepted", mode: "free" });
  });

  return app;
}

test("POST /audit in free mode (no payee address) does not return 402", async () => {
  const app = createTestApp(); // no payeeAddress

  const res = await app.request("/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageName: "test-pkg" }),
  });

  assert.notEqual(res.status, 402, "Should not return 402 in free mode");
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.mode, "free");
});

test("POST /audit with payee address configured returns 402", async () => {
  const app = createTestApp("0x1234567890abcdef1234567890abcdef12345678");

  const res = await app.request("/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageName: "test-pkg" }),
  });

  assert.equal(res.status, 402, "Should return 402 when payee address is set");
});

test("GET /health returns 200 without payment config", async () => {
  const app = createTestApp(); // no payeeAddress

  const res = await app.request("/health");

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("GET /health returns 200 even with payment config", async () => {
  const app = createTestApp("0x1234567890abcdef1234567890abcdef12345678");

  const res = await app.request("/health");

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("config payeeAddress controls payment mode via env", async () => {
  // Verify that when SHADOWNPM_PAYEE_ADDRESS is not set, config.payeeAddress is undefined
  const configModuleUrl = new URL("../../src/config.ts", import.meta.url).href;

  const mod = await withPatchedEnv(
    {
      SHADOWNPM_PAYEE_ADDRESS: undefined,
    },
    async () => await import(`${configModuleUrl}?t=${Date.now()}-${Math.random()}`),
  );

  assert.equal(mod.config.payeeAddress, undefined, "payeeAddress should be undefined when env var not set");

  // When not set, the app should operate in free mode (no payment gating)
  const app = createTestApp(mod.config.payeeAddress);
  const res = await app.request("/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageName: "test-pkg" }),
  });

  assert.notEqual(res.status, 402);
});
