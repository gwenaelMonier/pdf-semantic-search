import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmQuotaError, LlmTransientError } from "@/lib/llm-errors";

const { getGenerativeModelMock, GoogleGenerativeAIMock } = vi.hoisted(() => {
  const getGenerativeModelMock = vi.fn();
  // biome-ignore lint/complexity/useArrowFunction: appelé avec `new`, doit être une fonction constructible
  const GoogleGenerativeAIMock = vi.fn(function () {
    return { getGenerativeModel: getGenerativeModelMock };
  });
  return { getGenerativeModelMock, GoogleGenerativeAIMock };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: GoogleGenerativeAIMock,
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ GEMINI_API_KEY: "test-key", GEMINI_MODEL: undefined }),
}));

vi.mock("@/lib/prompts/system", () => ({ HR_SYSTEM_PROMPT: "system" }));

import { createGeminiClient } from "@/lib/gemini";

const OPTS = { pages: [{ index: 0, text: "page 1" }], history: [], question: "test?" };

function makeModel(chunks: string[], error?: unknown) {
  return {
    startChat: () => ({
      sendMessageStream: error
        ? () => {
            throw error;
          }
        : async () => ({
            stream: (async function* () {
              for (const c of chunks) yield { text: () => c };
            })(),
          }),
    }),
  };
}

beforeEach(() => {
  getGenerativeModelMock.mockReset();
});

describe("createGeminiClient — model rotation", () => {
  it("utilise gemini-2.5-flash-lite par défaut et retourne les chunks", async () => {
    getGenerativeModelMock.mockReturnValue(makeModel(["hello"]));
    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["hello"]);
    expect(model).toBe("gemini-2.5-flash-lite");
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
  });

  it("bascule sur gemini-2.5-flash quand flash-lite renvoie 429", async () => {
    getGenerativeModelMock
      .mockReturnValueOnce(makeModel([], new LlmQuotaError("quota", null)))
      .mockReturnValue(makeModel(["ok"]));
    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["ok"]);
    expect(model).toBe("gemini-2.5-flash");
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(2);
  });

  it("lève LlmQuotaError quand tous les modèles sont épuisés", async () => {
    getGenerativeModelMock.mockReturnValue(makeModel([], new LlmQuotaError("quota", null)));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(2);
  });

  it("ne réessaie pas quand un 429 arrive en cours de streaming", async () => {
    getGenerativeModelMock.mockReturnValue({
      startChat: () => ({
        sendMessageStream: async () => ({
          stream: (async function* () {
            yield { text: () => "partial" };
            throw new LlmQuotaError("quota mid-stream", null);
          })(),
        }),
      }),
    });
    const client = createGeminiClient();
    const { chunks } = await client.streamAnswer(OPTS);
    await expect(async () => {
      for await (const _ of chunks) {
        // drain
      }
    }).rejects.toBeInstanceOf(LlmQuotaError);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
  });

  it("ne réessaie pas sur une erreur non-quota", async () => {
    getGenerativeModelMock.mockReturnValue(makeModel([], new LlmTransientError("503")));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmTransientError);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
  });
});
