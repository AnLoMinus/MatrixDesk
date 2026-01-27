import { generateGemini } from "./gemini.js";
import { generateOllama } from "./ollama.js";

type ProviderPayload = {
  provider: "gemini" | "ollama";
  prompt: string;
  config?: Record<string, unknown>;
};

export async function generateWithProvider(payload: ProviderPayload) {
  if (payload.provider === "gemini") {
    return generateGemini(payload.prompt, payload.config);
  }
  return generateOllama(payload.prompt, payload.config);
}
