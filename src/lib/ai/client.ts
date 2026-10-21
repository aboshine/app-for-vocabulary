import { extractJson } from "./json";
import { mockResponse } from "./mock";

/**
 * Minimal AI client. Two providers are supported, both over plain fetch (no SDKs):
 *
 *  - Google Gemini (default, has a free tier): set GEMINI_API_KEY.
 *  - Anthropic Claude (paid, very cheap with Haiku): set ANTHROPIC_API_KEY and AI_PROVIDER=anthropic.
 *  - AI_PROVIDER=mock returns canned data (tests / trying the UI without a key).
 *
 * "smart" is used for graded texts (quality matters), "fast" for small jobs like
 * filling one card. If the first model is rate-limited or unavailable we retry once
 * with the other one, which matters on the Gemini free tier.
 */

export type AiTier = "smart" | "fast";
export type ProviderName = "gemini" | "anthropic" | "mock";

export interface AiRequest {
  system: string;
  prompt: string;
  tier?: AiTier;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiResult<T> {
  data: T;
  model: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const DEFAULT_MODELS: Record<Exclude<ProviderName, "mock">, Record<AiTier, string>> = {
  gemini: { smart: "gemini-3.8-flash", fast: "gemini-3.5-flash-lite" },
  anthropic: { smart: "claude-haiku-5-5", fast: "claude-haiku-5-5" },
};

export function activeProvider(env: NodeJS.ProcessEnv = process.env): ProviderName | null {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") return "mock";
  if (explicit === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (explicit === "gemini") return env.GEMINI_API_KEY ? "gemini" : null;
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function modelsFor(provider: ProviderName, tier: AiTier, env: NodeJS.ProcessEnv = process.env): string[] {
  if (provider === "mock") return ["mock"];
  const defaults = DEFAULT_MODELS[provider];
  const prefix = provider === "gemini" ? "GEMINI" : "ANTHROPIC";
  const smart = env[`${prefix}_MODEL`]?.trim() || defaults.smart;
  const fast = env[`${prefix}_FAST_MODEL`]?.trim() || defaults.fast;
  const ordered = tier === "smart" ? [smart, fast] : [fast, smart];
  return [...new Set(ordered)];
}

export function aiStatus(env: NodeJS.ProcessEnv = process.env) {
  const provider = activeProvider(env);
  return {
    configured: provider !== null,
    provider,
    smartModel: provider ? modelsFor(provider, "smart", env)[0] : null,
    fastModel: provider ? modelsFor(provider, "fast", env)[0] : null,
  };
}

export async function generateJson<T>(
  request: AiRequest,
  validate: (value: unknown) => T,
): Promise<AiResult<T>> {
  const provider = activeProvider();
  if (!provider) {
    throw new AiError(
      "AI is not configured. Add GEMINI_API_KEY to the environment (free key: https://aistudio.google.com/apikey).",
      503,
    );
  }
  const models = modelsFor(provider, request.tier ?? "smart");
  let lastError: unknown = null;

  for (const model of models) {
    // Each model gets one extra attempt when the JSON comes back malformed.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text =
          provider === "mock"
            ? mockResponse(request)
            : provider === "gemini"
              ? await callGemini(model, request)
              : await callAnthropic(model, request);
        return { data: validate(extractJson(text)), model };
      } catch (error) {
        lastError = error;
        if (error instanceof AiError && error.retryable) break; // try next model
        if (error instanceof AiError) throw error; // auth / bad request: no point retrying
        // Parsing or validation problem: retry the same model once.
      }
    }
  }
  if (lastError instanceof AiError) throw lastError;
  throw new AiError(
    `The AI answer could not be used${lastError instanceof Error ? `: ${lastError.message}` : ""}. Try again.`,
  );
}

async function callGemini(model: string, request: AiRequest): Promise<string> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxOutputTokens ?? 8192,
        },
      }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw httpError("Gemini", response.status, body.error?.message);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  if (!text.trim()) {
    throw new AiError(`Gemini returned an empty answer (${body.candidates?.[0]?.finishReason ?? "unknown"}).`, 502, true);
  }
  return text;
}

async function callAnthropic(model: string, request: AiRequest): Promise<string> {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxOutputTokens ?? 8192,
      temperature: request.temperature ?? 0.7,
      system: `${request.system}\n\nRespond with a single JSON object only, no prose and no code fences.`,
      messages: [{ role: "user", content: request.prompt }],
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw httpError("Claude", response.status, body.error?.message);
  return (body.content ?? []).map((block) => (block.type === "text" ? block.text ?? "" : "")).join("");
}

function httpError(name: string, status: number, message?: string): AiError {
  if (status === 429) {
    return new AiError(`${name}: daily/minute limit reached. Wait a bit and try again.`, 429, true);
  }
  if (status === 401 || status === 403) {
    return new AiError(`${name}: the API key was rejected. Check it in your environment settings.`, 401);
  }
  const retryable = status === 404 || status >= 500;
  return new AiError(`${name} error ${status}${message ? `: ${message}` : ""}`, 502, retryable);
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 90_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new AiError(
      error instanceof Error && error.name === "AbortError" ? "The AI took too long to answer." : "Could not reach the AI service.",
      504,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
