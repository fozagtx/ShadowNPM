import test from "node:test";
import assert from "node:assert/strict";

import { withPatchedEnv } from "../helpers/env.ts";

const configModuleUrl = new URL("../../src/config.ts", import.meta.url).href;

async function loadFreshConfigModule() {
  return await import(`${configModuleUrl}?t=${Date.now()}-${Math.random()}`);
}

test("payeeAddress accepts a valid 0x address", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_PAYEE_ADDRESS: "0x1234567890abcdef1234567890abcdef12345678",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.payeeAddress, "0x1234567890abcdef1234567890abcdef12345678");
});

test("payeeAddress rejects an invalid address", async () => {
  await assert.rejects(
    async () =>
      await withPatchedEnv(
        {
          SHADOWNPM_PAYEE_ADDRESS: "not-an-address",
        },
        async () => await loadFreshConfigModule(),
      ),
    /Invalid configuration:/,
  );
});

test("payeeAddress rejects a short hex string", async () => {
  await assert.rejects(
    async () =>
      await withPatchedEnv(
        {
          SHADOWNPM_PAYEE_ADDRESS: "0x1234",
        },
        async () => await loadFreshConfigModule(),
      ),
    /Invalid configuration:/,
  );
});

test("payeeAddress is optional (undefined when not set)", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_PAYEE_ADDRESS: undefined,
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.payeeAddress, undefined);
});

test("facilitatorUrl defaults to https://x402.org/facilitator", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_FACILITATOR_URL: undefined,
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.facilitatorUrl, "https://x402.org/facilitator");
});

test("facilitatorUrl accepts a custom URL", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_FACILITATOR_URL: "https://custom-facilitator.example.com/v1",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.facilitatorUrl, "https://custom-facilitator.example.com/v1");
});

test("auditPriceUsd defaults to $0.001", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_AUDIT_PRICE_USD: undefined,
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.auditPriceUsd, "$0.001");
});

test("auditPriceUsd accepts a custom value", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_AUDIT_PRICE_USD: "$0.50",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.auditPriceUsd, "$0.50");
});

test("old contractAddress env var is not recognized by the schema", async () => {
  // Setting the old env var should have no effect on config — no 'contractAddress' key
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_CONTRACT_ADDRESS: "0x1234567890abcdef1234567890abcdef12345678",
      SHADOWNPM_PAYEE_ADDRESS: undefined,
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal((mod.config as any).contractAddress, undefined);
  assert.equal(mod.config.payeeAddress, undefined);
});

test("old ogRpcUrl env var is not recognized by the schema", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_OG_RPC_URL: "https://custom-rpc.example.com",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal((mod.config as any).ogRpcUrl, undefined);
});
