/**
 * Camada de abstração de provedor de LLM.
 *
 * O modelo é configurável por variável de ambiente (LLM_PROVIDER + LLM_MODEL).
 * Usamos o Vercel AI SDK como fronteira comum: Mastra aceita um modelo do AI SDK
 * diretamente, então trocar de Google para Anthropic/OpenAI é só trocar o env.
 *
 * Se nenhuma chave estiver configurada, `isLlmConfigured()` retorna false e o
 * agent opera em modo determinístico (ver engine.ts).
 */

import type { LanguageModelV1 } from "ai";

export type LlmProvider = "google" | "anthropic" | "openai";

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  google: "gemini-2.0-flash",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
};

const API_KEY_ENV: Record<LlmProvider, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export function getProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? "google").toLowerCase();
  if (raw === "google" || raw === "anthropic" || raw === "openai") return raw;
  return "google";
}

export function getModelId(): string {
  const provider = getProvider();
  return process.env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider];
}

/** True quando há chave de API para o provider selecionado. */
export function isLlmConfigured(): boolean {
  const provider = getProvider();
  const key = process.env[API_KEY_ENV[provider]];
  return typeof key === "string" && key.trim().length > 0;
}

export interface LlmInfo {
  provider: LlmProvider;
  modelId: string;
  configured: boolean;
}

export function getLlmInfo(): LlmInfo {
  return {
    provider: getProvider(),
    modelId: getModelId(),
    configured: isLlmConfigured(),
  };
}

/**
 * Constrói o modelo do AI SDK para o provider configurado. Retorna null quando
 * não há chave (o agent então usa o motor determinístico). O import dos SDKs é
 * dinâmico para não carregar provedores não usados.
 */
export async function getModel(): Promise<LanguageModelV1 | null> {
  if (!isLlmConfigured()) return null;
  const provider = getProvider();
  const modelId = getModelId();

  switch (provider) {
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(modelId);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return openai(modelId);
    }
  }
}
