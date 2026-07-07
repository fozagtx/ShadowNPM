import "dotenv/config";
import { z } from "zod";

const LLMBackend = z.enum(["anthropic", "openrouter", "openai_compatible"]);

const ConfigSchema = z.object({
  llmBackend: LLMBackend.default("openrouter"),
  llmBaseUrl: z.string().url().optional(),
  llmApiKey: z.string().optional(),
  llmTimeoutSeconds: z.coerce.number().positive().default(60),

  apiHost: z.string().default("0.0.0.0"),
  apiPort: z.coerce.number().int().min(1).max(65535).default(8000),

  // Payment verification (x402 / Arc Nanopayments)
  payeeAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid 0x-prefixed Ethereum address").optional(),
  facilitatorUrl: z.string().url().default("https://x402.org/facilitator"),
  auditPriceUsd: z.string().default("$0.001"),

  triageModel: z.string().default("anthropic/claude-3-haiku"),
  triageRiskThreshold: z.coerce.number().int().min(0).max(10).default(3),

  investigationModel: z.string().default("anthropic/claude-sonnet-4"),
  maxAgentTurns: z.coerce.number().int().min(1).max(200).default(30),
  investigationEnabled: z
    .string()
    .transform((v) => v.toLowerCase() !== "false")
    .default("true"),

  testGenModel: z.string().default("anthropic/claude-sonnet-4"),
  testGenMode: z.enum(["openclaw", "direct"]).default("direct"),
  verifyTimeoutSec: z.coerce.number().int().min(10).max(300).default(60),

  sandboxImage: z.string().default("node:22-slim"),
  sandboxMemoryMb: z.coerce.number().int().min(64).max(4096).default(512),
  sandboxCpus: z.coerce.number().positive().max(4).default(1),
  sandboxNetwork: z.string().default("none"),
  maxDockerExecTimeoutSec: z.coerce.number().int().min(5).max(300).default(30),
});

function loadConfig() {
  const env = process.env;
  const raw = {
    llmBackend: env.SHADOWNPM_LLM_BACKEND,
    llmBaseUrl: env.SHADOWNPM_LLM_BASE_URL || "https://openrouter.ai/api/v1",
    llmApiKey: env.OPENROUTER_API_KEY || env.SHADOWNPM_LLM_API_KEY,
    llmTimeoutSeconds: env.SHADOWNPM_LLM_TIMEOUT_SECONDS,
    apiHost: env.SHADOWNPM_API_HOST,
    apiPort: env.SHADOWNPM_API_PORT,
    payeeAddress: env.SHADOWNPM_PAYEE_ADDRESS || "0x20baD79b6Af945aA3C8087256bdb8870Dc2679E4",
    facilitatorUrl: env.SHADOWNPM_FACILITATOR_URL,
    auditPriceUsd: env.SHADOWNPM_AUDIT_PRICE_USD,
    triageModel: env.SHADOWNPM_TRIAGE_MODEL,
    triageRiskThreshold: env.SHADOWNPM_TRIAGE_RISK_THRESHOLD,
    investigationModel: env.SHADOWNPM_INVESTIGATION_MODEL,
    maxAgentTurns: env.SHADOWNPM_MAX_AGENT_TURNS,
    investigationEnabled: env.SHADOWNPM_INVESTIGATION_ENABLED,
    testGenModel: env.SHADOWNPM_TEST_GEN_MODEL,
    testGenMode: env.SHADOWNPM_TEST_GEN_MODE,
    verifyTimeoutSec: env.SHADOWNPM_VERIFY_TIMEOUT_SEC,
    sandboxImage: env.SHADOWNPM_SANDBOX_IMAGE,
    sandboxMemoryMb: env.SHADOWNPM_SANDBOX_MEMORY_MB,
    sandboxCpus: env.SHADOWNPM_SANDBOX_CPUS,
    sandboxNetwork: env.SHADOWNPM_SANDBOX_NETWORK,
    maxDockerExecTimeoutSec: env.SHADOWNPM_MAX_DOCKER_EXEC_TIMEOUT_SEC,
  };

  // Strip undefined keys so Zod defaults apply
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  );

  const result = ConfigSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }

  // Auto-detect: OpenRouter/OAI-compatible if API key is set, else Anthropic
  result.data.llmBackend = (result.data.llmApiKey && raw.llmBackend !== "anthropic")
    ? "openai_compatible"
    : "anthropic";

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;

export const SKIP_DIRS = new Set(["node_modules", ".git", ".svn"]);

/** File types (from classify.ts) that the LLM analyzes in triage. */
export const SOURCE_FILE_TYPES = new Set(["js", "ts"]);
