import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject as _generateObject } from "ai";
import { config } from "./config.js";

export function getModel(modelName: string) {
  if (config.llmBackend === "anthropic") {
    return anthropic(modelName);
  }
  if (!config.llmBaseUrl) {
    throw new Error("SHADOWNPM_LLM_BASE_URL is required for openai_compatible backend");
  }
  const openai = createOpenAI({
    baseURL: config.llmBaseUrl,
    apiKey: config.llmApiKey ?? "",
  });
  return openai(modelName);
}

/**
 * Wrapper around generateObject that retries on "No object generated" errors.
 * This happens when the model doesn't produce a valid tool call.
 */
export async function generateObjectWithRetry(
  opts: any,
  maxRetries = 3,
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await _generateObject(opts);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("No object generated") && attempt < maxRetries) {
        console.warn(`[llm] generateObject failed (attempt ${attempt}/${maxRetries}): ${msg} — retrying...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
