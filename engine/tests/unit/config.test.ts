import test from "node:test";
import assert from "node:assert/strict";

import { withPatchedEnv } from "../helpers/env.ts";

const configModuleUrl = new URL("../../src/config.ts", import.meta.url).href;

async function loadFreshConfigModule() {
  return await import(`${configModuleUrl}?t=${Date.now()}-${Math.random()}`);
}

test("config defaults to anthropic backend and documented sandbox values", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_LLM_BACKEND: undefined,
      SHADOWNPM_LLM_BASE_URL: undefined,
      SHADOWNPM_LLM_API_KEY: undefined,
      SHADOWNPM_LLM_TIMEOUT_SECONDS: undefined,
      SHADOWNPM_API_HOST: undefined,
      SHADOWNPM_API_PORT: undefined,
      SHADOWNPM_SANDBOX_IMAGE: undefined,
      SHADOWNPM_SANDBOX_MEMORY_MB: undefined,
      SHADOWNPM_SANDBOX_CPUS: undefined,
      SHADOWNPM_SANDBOX_NETWORK: undefined,
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.llmBackend, "anthropic");
  assert.equal(mod.config.llmTimeoutSeconds, 60);
  assert.equal(mod.config.apiHost, "0.0.0.0");
  assert.equal(mod.config.apiPort, 8000);
  assert.equal(mod.config.sandboxImage, "node:22-slim");
  assert.equal(mod.config.sandboxMemoryMb, 512);
  assert.equal(mod.config.sandboxCpus, 1);
  assert.equal(mod.config.sandboxNetwork, "none");
});

test("config accepts openai_compatible backend when base URL is set", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_LLM_BACKEND: "openai_compatible",
      SHADOWNPM_LLM_BASE_URL: "https://compute-network-6.integratenetwork.work/v1/proxy",
      SHADOWNPM_LLM_API_KEY: "app-sk-test",
      SHADOWNPM_LLM_TIMEOUT_SECONDS: "90",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.llmBackend, "openai_compatible");
  assert.equal(mod.config.llmBaseUrl, "https://compute-network-6.integratenetwork.work/v1/proxy");
  assert.equal(mod.config.llmApiKey, "app-sk-test");
  assert.equal(mod.config.llmTimeoutSeconds, 90);
});

test("config throws when openai_compatible backend has no base URL", async () => {
  await assert.rejects(
    async () =>
      await withPatchedEnv(
        {
          SHADOWNPM_LLM_BACKEND: "openai_compatible",
          SHADOWNPM_LLM_BASE_URL: undefined,
        },
        async () => await loadFreshConfigModule(),
      ),
    /SHADOWNPM_LLM_BASE_URL is required when SHADOWNPM_LLM_BACKEND=openai_compatible/,
  );
});

test("config validates Ethereum payee address shape", async () => {
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

test("config coerces numeric environment values", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_API_PORT: "9001",
      SHADOWNPM_TRIAGE_RISK_THRESHOLD: "5",
      SHADOWNPM_MAX_AGENT_TURNS: "12",
      SHADOWNPM_VERIFY_TIMEOUT_SEC: "120",
      SHADOWNPM_SANDBOX_MEMORY_MB: "768",
      SHADOWNPM_SANDBOX_CPUS: "1.5",
      SHADOWNPM_MAX_DOCKER_EXEC_TIMEOUT_SEC: "45",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.apiPort, 9001);
  assert.equal(mod.config.triageRiskThreshold, 5);
  assert.equal(mod.config.maxAgentTurns, 12);
  assert.equal(mod.config.verifyTimeoutSec, 120);
  assert.equal(mod.config.sandboxMemoryMb, 768);
  assert.equal(mod.config.sandboxCpus, 1.5);
  assert.equal(mod.config.maxDockerExecTimeoutSec, 45);
});

test("config treats SHADOWNPM_INVESTIGATION_ENABLED=false as false", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_INVESTIGATION_ENABLED: "false",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.investigationEnabled, false);
});

test("config leaves investigation enabled for non-false strings", async () => {
  const mod = await withPatchedEnv(
    {
      SHADOWNPM_INVESTIGATION_ENABLED: "TRUE",
    },
    async () => await loadFreshConfigModule(),
  );

  assert.equal(mod.config.investigationEnabled, true);
});

test("config exports the expected static directory and source file sets", async () => {
  const mod = await withPatchedEnv({}, async () => await loadFreshConfigModule());

  assert.ok(mod.SKIP_DIRS.has("node_modules"));
  assert.ok(mod.SKIP_DIRS.has(".git"));
  assert.ok(mod.SOURCE_FILE_TYPES.has("js"));
  assert.ok(mod.SOURCE_FILE_TYPES.has("ts"));
});
