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
  /** false = free-text answer (tutor chat); default is a JSON answer */
  json?: boolean;
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
    /** why a retryable error happened; decides how long the model rests */
    readonly kind: "busy" | "quota" | "missing" = "busy",
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

/** Middle Gemini model, tried between the main and the light one. GEMINI_MID_MODEL="" turns it off. */
const DEFAULT_GEMINI_MID = "gemini-3.6-flash";

/**
 * Models to try, in order. Gemini's free tier often answers "high demand" (503) on the
 * newest model, so there are three steps: main → middle → light. Quick tasks go the other way.
 */
export function modelsFor(provider: ProviderName, tier: AiTier, env: NodeJS.ProcessEnv = process.env): string[] {
  if (provider === "mock") return ["mock"];
  const defaults = DEFAULT_MODELS[provider];
  const prefix = provider === "gemini" ? "GEMINI" : "ANTHROPIC";
  const smart = env[`${prefix}_MODEL`]?.trim() || defaults.smart;
  const fast = env[`${prefix}_FAST_MODEL`]?.trim() || defaults.fast;
  const mid = provider === "gemini" ? (env.GEMINI_MID_MODEL === undefined ? DEFAULT_GEMINI_MID : env.GEMINI_MID_MODEL.trim()) : "";
  const ordered = (tier === "smart" ? [smart, mid, fast] : [fast, mid, smart]).filter(Boolean);
  return [...new Set(ordered)];
}

/* ------------------------------------------------------------------ model health */

/**
 * A model that just failed (overloaded, too slow, out of quota, unknown) is skipped for a
 * while, so the next requests go straight to one that works instead of waiting on it again.
 * Kept in memory per server instance: enough for a study session, and it heals by itself.
 */
const downUntil = new Map<string, number>();

export function resetModelHealth() {
  downUntil.clear();
}

export function markModelDown(model: string, error: unknown, now = Date.now()) {
  if (!(error instanceof AiError) || !error.retryable) return;
  const minutes = error.kind === "missing" ? 360 : error.kind === "quota" ? 2 : 5;
  downUntil.set(model, now + minutes * 60_000);
}

/** The usual order minus models that are resting; if every model is resting, try them all anyway. */
export function healthyModels(models: string[], now = Date.now()): string[] {
  const up = models.filter((model) => (downUntil.get(model) ?? 0) <= now);
  return up.length ? up : models;
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
  const models = healthyModels(modelsFor(provider, request.tier ?? "smart"));
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
        if (error instanceof AiError && error.retryable) {
          markModelDown(model, error);
          break; // try next model
        }
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

/** Free-text answer (used by the tutor chat). Same providers and fallback as generateJson. */
export async function generateText(request: AiRequest): Promise<AiResult<string>> {
  const provider = activeProvider();
  if (!provider) {
    throw new AiError(
      "AI is not configured. Add GEMINI_API_KEY to the environment (free key: https://aistudio.google.com/apikey).",
      503,
    );
  }
  const req = { ...request, json: false };
  let lastError: unknown = null;
  for (const model of healthyModels(modelsFor(provider, request.tier ?? "fast"))) {
    try {
      const text =
        provider === "mock" ? mockResponse(req) : provider === "gemini" ? await callGemini(model, req) : await callAnthropic(model, req);
      if (text.trim()) return { data: text.trim(), model };
      lastError = new AiError("The AI returned an empty answer.", 502, true);
    } catch (error) {
      lastError = error;
      if (!(error instanceof AiError) || !error.retryable) throw error;
      markModelDown(model, error);
    }
  }
  throw lastError instanceof Error ? lastError : new AiError("The AI did not answer. Try again.");
}

/**
 * Gemini "thinking" makes answers much slower and these tasks do not need it, so we ask
 * for the lowest setting. Gemini 2.5 uses a token budget, newer models a level; a model
 * that rejects the setting is simply called again without it.
 */
export function geminiThinkingConfig(model: string): Record<string, unknown> | null {
  if (/gemini-2\.5-pro/.test(model)) return null; // cannot be turned down this way
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: 0 };
  // 3.5 / 3.6 accept "minimal" (fastest); newer ones reject it, so they get "low"
  if (/gemini-3\.[0-6](\D|$)/.test(model)) return { thinkingLevel: "minimal" };
  if (/gemini-([3-9]|\d{2,})/.test(model)) return { thinkingLevel: "low" };
  return null;
}

/** Models that refused the thinking setting once; skip it for them from then on (per server instance). */
const noThinkingConfig = new Set<string>();

function geminiBody(model: string, request: AiRequest, withThinking: boolean) {
  const thinking = withThinking && !noThinkingConfig.has(model) ? geminiThinkingConfig(model) : null;
  return JSON.stringify({
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    generationConfig: {
      ...(request.json === false ? {} : { responseMimeType: "application/json" }),
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxOutputTokens ?? 8192,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  });
}

/**
 * Every Gemini call is streamed: the server answers as soon as the model starts writing.
 * So we only have to wait a few seconds to know a model is alive, and a stuck one is
 * abandoned quickly for the next, however long the full answer takes afterwards.
 */
export const CHAT_START_TIMEOUT_MS = 7_000;
export const JSON_START_TIMEOUT_MS = 12_000;

async function geminiFetch(model: string, request: AiRequest): Promise<Response> {
  const ms = request.json === false ? CHAT_START_TIMEOUT_MS : JSON_START_TIMEOUT_MS;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const init = (withThinking: boolean): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: geminiBody(model, request, withThinking),
  });
  let response = await fetchWithTimeout(url, init(true), ms);
  if (response.status === 400 && !noThinkingConfig.has(model) && geminiThinkingConfig(model)) {
    // most likely this model does not accept the thinking setting: remember that and retry plainly
    noThinkingConfig.add(model);
    response = await fetchWithTimeout(url, init(false), ms);
  }
  return response;
}

type GeminiChunk = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  error?: { message?: string };
};

function chunkText(body: GeminiChunk): string {
  return (body.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
}

/** Text pieces of one streamed Gemini answer (thought parts skipped). Throws AiError on HTTP errors. */
async function* geminiPieces(model: string, request: AiRequest): AsyncGenerator<string> {
  const response = await geminiFetch(model, request);
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as GeminiChunk;
    throw httpError("Gemini", response.status, body.error?.message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      let text = "";
      try {
        text = chunkText(JSON.parse(line.slice(5)) as GeminiChunk);
      } catch {
        continue; // partial or keep-alive line
      }
      if (text) yield text;
    }
  }
}

async function callGemini(model: string, request: AiRequest): Promise<string> {
  let text = "";
  try {
    for await (const piece of geminiPieces(model, request)) text += piece;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError("The connection to Gemini broke off.", 502, true); // network cut mid-answer
  }
  if (!text.trim()) throw new AiError("Gemini returned an empty answer.", 502, true);
  return text;
}

/**
 * Free-text answer delivered piece by piece, so the reader sees the first words after
 * about a second instead of waiting for the whole answer. Gemini streams for real; other
 * providers yield the full answer as one piece. Falls back to the second model only if
 * nothing has been sent yet.
 */
export async function* streamText(request: AiRequest, info: { model?: string } = {}): AsyncGenerator<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new AiError("AI is not configured. Add GEMINI_API_KEY to the environment (free key: https://aistudio.google.com/apikey).", 503);
  }
  const req = { ...request, json: false };
  if (provider !== "gemini") {
    const whole = await generateText(req);
    info.model = whole.model;
    yield whole.data;
    return;
  }
  let lastError: unknown = null;
  for (const model of healthyModels(modelsFor(provider, request.tier ?? "fast"))) {
    let sent = false;
    try {
      for await (const text of geminiPieces(model, req)) {
        sent = true;
        info.model = model;
        yield text;
      }
      if (sent) return;
      lastError = new AiError("Gemini returned an empty answer.", 502, true);
    } catch (error) {
      if (sent) throw error; // half an answer is already on screen: do not start over with another model
      lastError = error;
      if (!(error instanceof AiError) || !error.retryable) throw error;
      markModelDown(model, error);
    }
  }
  throw lastError instanceof Error ? lastError : new AiError("The AI did not answer. Try again.");
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
      system:
        request.json === false
          ? request.system
          : `${request.system}\n\nRespond with a single JSON object only, no prose and no code fences.`,
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
    return new AiError(`${name}: daily/minute limit reached. Wait a bit and try again.`, 429, true, "quota");
  }
  if (status === 401 || status === 403) {
    return new AiError(`${name}: the API key was rejected. Check it in your environment settings.`, 401);
  }
  const retryable = status === 404 || status >= 500;
  return new AiError(`${name} error ${status}${message ? `: ${message}` : ""}`, 502, retryable, status === 404 ? "missing" : "busy");
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

/* ------------------------------------------------------------------ speed test */

export interface ModelProbe {
  model: string;
  role: string;
  ok: boolean;
  /** ms until the first words arrived */
  firstMs: number | null;
  totalMs: number;
  error: string;
}

/** Ask one model a tiny question and time it (no fallback), for the "Test AI speed" button. */
async function probeModel(model: string, role: string): Promise<ModelProbe> {
  const started = Date.now();
  let firstMs: number | null = null;
  try {
    const request: AiRequest = { system: "TASK: chat\nAnswer in one short sentence.", prompt: "Say hello in Korean and translate it.", json: false, maxOutputTokens: 200 };
    for await (const piece of geminiPieces(model, request)) {
      if (piece && firstMs === null) firstMs = Date.now() - started;
    }
    return { model, role, ok: firstMs !== null, firstMs, totalMs: Date.now() - started, error: firstMs === null ? "empty answer" : "" };
  } catch (error) {
    return { model, role, ok: false, firstMs, totalMs: Date.now() - started, error: error instanceof Error ? error.message : "failed" };
  }
}

export async function probeModels(): Promise<ModelProbe[]> {
  const provider = activeProvider();
  if (provider !== "gemini") return [];
  const chain = modelsFor(provider, "smart");
  const roles = ["main: texts, lessons, chat", "middle: backup", "light: quick tasks, last backup"];
  const list: Array<[string, string]> = chain.map((model, i) => [model, chain.length === 1 ? "all tasks" : i === chain.length - 1 ? roles[2] : roles[Math.min(i, 1)]]);
  return Promise.all(list.map(([model, role]) => probeModel(model, role)));
}
