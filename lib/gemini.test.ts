import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmQuotaError, LlmTransientError } from "@/lib/llm-errors";

const { chatsCreateMock, GoogleGenAIMock, envMock } = vi.hoisted(() => {
  const chatsCreateMock = vi.fn();
  // biome-ignore lint/complexity/useArrowFunction: called with `new`, must be a constructible function
  const GoogleGenAIMock = vi.fn(function () {
    return { chats: { create: chatsCreateMock } };
  });
  const envMock = vi.fn<() => { GEMINI_API_KEYS: string[]; GEMINI_MODEL: string | undefined }>();
  return { chatsCreateMock, GoogleGenAIMock, envMock };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: GoogleGenAIMock,
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => envMock(),
}));

vi.mock("@/lib/prompts/system", () => ({ SYSTEM_PROMPT: "system" }));

import { createGeminiClient, ROTATION_MODELS } from "@/lib/gemini";

const MODEL_COUNT = ROTATION_MODELS.length;
const OPTS = { pages: [{ index: 0, text: "page 1" }], history: [], question: "test?" };

function makeChat(chunks: string[], error?: unknown) {
  return {
    sendMessageStream: error
      ? async () => {
          throw error;
        }
      : async () => {
          return (async function* () {
            for (const c of chunks) yield { text: c };
          })();
        },
  };
}

beforeEach(() => {
  chatsCreateMock.mockReset();
  GoogleGenAIMock.mockClear();
  envMock.mockReset();
  envMock.mockReturnValue({ GEMINI_API_KEYS: ["test-key"], GEMINI_MODEL: undefined });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("createGeminiClient — model rotation", () => {
  it("uses the first ROTATION_MODELS model by default and returns chunks", async () => {
    chatsCreateMock.mockReturnValue(makeChat(["hello"]));
    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["hello"]);
    expect(model).toBe(ROTATION_MODELS[0]);
    expect(chatsCreateMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next model when the first returns 429", async () => {
    chatsCreateMock
      .mockReturnValueOnce(makeChat([], new LlmQuotaError("quota", null)))
      .mockReturnValue(makeChat(["ok"]));
    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["ok"]);
    expect(model).toBe(ROTATION_MODELS[1]);
    expect(chatsCreateMock).toHaveBeenCalledTimes(2);
  });

  it("throws LlmQuotaError when all models of the single key are exhausted", async () => {
    chatsCreateMock.mockReturnValue(makeChat([], new LlmQuotaError("quota", null)));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT);
  });

  it("does not retry when a 429 occurs during streaming", async () => {
    chatsCreateMock.mockReturnValue({
      sendMessageStream: async () => {
        return (async function* () {
          yield { text: "partial" };
          throw new LlmQuotaError("quota mid-stream", null);
        })();
      },
    });
    const client = createGeminiClient();
    const { chunks } = await client.streamAnswer(OPTS);
    await expect(async () => {
      for await (const _ of chunks) {
        // drain
      }
    }).rejects.toBeInstanceOf(LlmQuotaError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a non-quota error", async () => {
    chatsCreateMock.mockReturnValue(makeChat([], new LlmTransientError("503")));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmTransientError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe("createGeminiClient — rotation multi-clés", () => {
  it("falls back to the 2nd key when all models of the 1st are 429", async () => {
    envMock.mockReturnValue({ GEMINI_API_KEYS: ["k1", "k2"], GEMINI_MODEL: undefined });
    // First set (key 1): all models 429. Then key 2: immediate success.
    for (let i = 0; i < MODEL_COUNT; i++) {
      chatsCreateMock.mockReturnValueOnce(makeChat([], new LlmQuotaError("quota k1", null)));
    }
    chatsCreateMock.mockReturnValue(makeChat(["ok"]));

    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["ok"]);
    expect(model).toBe(ROTATION_MODELS[0]);
    // MODEL_COUNT failures on k1 + 1 success on k2
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT + 1);
    // GoogleGenAI instantiated twice (once per key)
    expect(GoogleGenAIMock).toHaveBeenCalledTimes(2);
    expect(GoogleGenAIMock).toHaveBeenNthCalledWith(1, { apiKey: "k1" });
    expect(GoogleGenAIMock).toHaveBeenNthCalledWith(2, { apiKey: "k2" });
  });

  it("throws LlmQuotaError when all keys × all models are exhausted", async () => {
    envMock.mockReturnValue({ GEMINI_API_KEYS: ["k1", "k2"], GEMINI_MODEL: undefined });
    chatsCreateMock.mockReturnValue(makeChat([], new LlmQuotaError("quota", null)));

    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT * 2);
    expect(GoogleGenAIMock).toHaveBeenCalledTimes(2);
  });
});
