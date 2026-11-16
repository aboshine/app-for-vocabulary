import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, generateJson, geminiThinkingConfig, generateText, healthyModels, markModelDown, modelsFor, probeModels, resetModelHealth, streamText } from "../lib/ai/client";
import { chatPrompt, teacherVoice } from "../lib/ai/tutor-prompts";

function sse(lines: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) controller.enqueue(encoder.encode(line));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const piece = (text: string, thought = false) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text, thought }] } }] })}\n\n`;

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const part of gen) out.push(part);
  return out;
}

describe("gemini speed settings", () => {
  it("asks for the lowest thinking the model family supports", () => {
    expect(geminiThinkingConfig("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(geminiThinkingConfig("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
    expect(geminiThinkingConfig("gemini-2.5-pro")).toBeNull();
    expect(geminiThinkingConfig("gemini-3.8-flash")).toEqual({ thinkingLevel: "low" });
    expect(geminiThinkingConfig("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(geminiThinkingConfig("gemini-3.6-flash")).toEqual({ thinkingLevel: "minimal" });
    expect(geminiThinkingConfig("gemini-2.0-flash")).toBeNull();
  });
});

describe("streaming answers", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_FAST_MODEL", "gemini-3.5-flash-lite");
    vi.stubEnv("GEMINI_MID_MODEL", ""); // two-model chain unless a test says otherwise
    resetModelHealth();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("yields text pieces as they arrive, skipping thoughts and split lines", async () => {
    const whole = piece("안녕") + piece("thinking…", true) + piece("하세요");
    // cut the stream in the middle of a line to prove partial lines are joined
    fetchMock.mockResolvedValueOnce(sse([whole.slice(0, 30), whole.slice(30)]));
    expect(await collect(streamText({ system: "s", prompt: "p", tier: "smart" }))).toEqual(["안녕", "하세요"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-3.8-flash:streamGenerateContent?alt=sse");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });

  it("falls back to the other model when the first is rate limited", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }))
      .mockResolvedValueOnce(sse([piece("ok")]));
    expect(await collect(streamText({ system: "s", prompt: "p", tier: "smart" }))).toEqual(["ok"]);
    expect(fetchMock.mock.calls[1][0]).toContain("gemini-3.5-flash-lite");
  });

  it("retries without the thinking setting when a model rejects it, and remembers that", async () => {
    vi.stubEnv("GEMINI_FAST_MODEL", "gemini-9.9-test");
    const ok = () => sse([piece("hi")]);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "unknown field thinkingLevel" } }), { status: 400 })).mockImplementation(async () => ok());
    expect((await generateText({ system: "s", prompt: "p", tier: "fast" })).data).toBe("hi");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.thinkingConfig).toBeDefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined();
    await generateText({ system: "s", prompt: "p", tier: "fast" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // third call went straight through without the setting
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it("gives up on a model that does not start answering and uses the other one", async () => {
    const stuck = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValueOnce(stuck).mockResolvedValueOnce(sse([piece("late but fine")]));
    const info: { model?: string } = {};
    expect(await collect(streamText({ system: "s", prompt: "p", tier: "smart" }, info))).toEqual(["late but fine"]);
    expect(info.model).toBe("gemini-3.5-flash-lite");
  });

  it("times each model for the speed test and reports failures without throwing", async () => {
    fetchMock.mockResolvedValueOnce(sse([piece("안녕하세요")])).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }));
    const probes = await probeModels();
    expect(probes.map((p) => p.ok)).toEqual([true, false]);
    expect(probes[0].firstMs).not.toBeNull();
    expect(probes[1].error).toMatch(/limit/);
  });

  it("tries main, then middle, then light, and lets a failed model rest", async () => {
    vi.stubEnv("GEMINI_MID_MODEL", "gemini-3.6-flash");
    expect(modelsFor("gemini", "smart")).toEqual(["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(modelsFor("gemini", "fast")).toEqual(["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]);
    const busy = () => new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 });
    fetchMock.mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockImplementation(async () => sse([piece("ok")]));
    expect(await collect(streamText({ system: "s", prompt: "p", tier: "smart" }))).toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // the next question goes straight to the model that works
    expect(await collect(streamText({ system: "s", prompt: "p", tier: "smart" }))).toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][0]).toContain("gemini-3.5-flash-lite");
  });

  it("brings a rested model back, and still tries everything when all are resting", () => {
    const busy = new AiError("x", 502, true);
    markModelDown("a", busy, 1_000);
    expect(healthyModels(["a", "b"], 2_000)).toEqual(["b"]);
    expect(healthyModels(["a", "b"], 1_000 + 6 * 60_000)).toEqual(["a", "b"]);
    markModelDown("b", busy, 1_000);
    expect(healthyModels(["a", "b"], 2_000)).toEqual(["a", "b"]);
    markModelDown("c", new AiError("bad key", 401), 1_000); // not retryable: not a health problem
    expect(healthyModels(["c"], 2_000)).toEqual(["c"]);
  });

  it("reads JSON answers from the stream too", async () => {
    const whole = piece('{"a":') + piece("1}");
    fetchMock.mockResolvedValueOnce(sse([whole]));
    const result = await generateJson({ system: "s", prompt: "p", tier: "smart" }, (v) => v as { a: number });
    expect(result.data).toEqual({ a: 1 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseMimeType).toBe("application/json");
  });

  it("reports an auth error instead of an empty stream", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(collect(streamText({ system: "s", prompt: "p" }))).rejects.toThrow(/API key/);
  });
});

describe("teacher instructions", () => {
  it("does not greet and treats Kazakh comparison as on-topic, in every language", () => {
    const system = chatPrompt({ messages: [{ role: "user", content: "сравни с казахским" }], level: 2, lang: "ru", weakWords: [] }).system;
    expect(system).toContain("Never greet");
    expect(system).toContain("Comparing Korean with Kazakh");
    expect(teacherVoice("ru")).toContain("native language is Kazakh");
  });
});
