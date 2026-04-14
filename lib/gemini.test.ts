import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmQuotaError, LlmTransientError } from "@/lib/llm-errors";

const { chatsCreateMock, GoogleGenAIMock, envMock } = vi.hoisted(() => {
  const chatsCreateMock = vi.fn();
  // biome-ignore lint/complexity/useArrowFunction: appelé avec `new`, doit être une fonction constructible
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

vi.mock("@/lib/prompts/system", () => ({ HR_SYSTEM_PROMPT: "system" }));

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
  it("utilise le premier modèle de ROTATION_MODELS par défaut et retourne les chunks", async () => {
    chatsCreateMock.mockReturnValue(makeChat(["hello"]));
    const client = createGeminiClient();
    const { model, chunks } = await client.streamAnswer(OPTS);
    const result: string[] = [];
    for await (const c of chunks) result.push(c);
    expect(result).toEqual(["hello"]);
    expect(model).toBe(ROTATION_MODELS[0]);
    expect(chatsCreateMock).toHaveBeenCalledTimes(1);
  });

  it("bascule sur le modèle suivant quand le premier renvoie 429", async () => {
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

  it("lève LlmQuotaError quand tous les modèles de l'unique clé sont épuisés", async () => {
    chatsCreateMock.mockReturnValue(makeChat([], new LlmQuotaError("quota", null)));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT);
  });

  it("ne réessaie pas quand un 429 arrive en cours de streaming", async () => {
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

  it("ne réessaie pas sur une erreur non-quota", async () => {
    chatsCreateMock.mockReturnValue(makeChat([], new LlmTransientError("503")));
    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmTransientError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe("createGeminiClient — rotation multi-clés", () => {
  it("bascule sur la 2e clé quand tous les modèles de la 1ère sont en 429", async () => {
    envMock.mockReturnValue({ GEMINI_API_KEYS: ["k1", "k2"], GEMINI_MODEL: undefined });
    // Premier set (clé 1) : tous les modèles en 429. Puis clé 2 : succès immédiat.
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
    // MODEL_COUNT échecs sur k1 + 1 succès sur k2
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT + 1);
    // GoogleGenAI instancié 2 fois (1 par clé)
    expect(GoogleGenAIMock).toHaveBeenCalledTimes(2);
    expect(GoogleGenAIMock).toHaveBeenNthCalledWith(1, { apiKey: "k1" });
    expect(GoogleGenAIMock).toHaveBeenNthCalledWith(2, { apiKey: "k2" });
  });

  it("lève LlmQuotaError quand toutes les clés × tous les modèles sont épuisés", async () => {
    envMock.mockReturnValue({ GEMINI_API_KEYS: ["k1", "k2"], GEMINI_MODEL: undefined });
    chatsCreateMock.mockReturnValue(makeChat([], new LlmQuotaError("quota", null)));

    const client = createGeminiClient();
    await expect(client.streamAnswer(OPTS)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(chatsCreateMock).toHaveBeenCalledTimes(MODEL_COUNT * 2);
    expect(GoogleGenAIMock).toHaveBeenCalledTimes(2);
  });
});
