import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmQuotaError, LlmTransientError } from "@/lib/llm-errors";

const { streamAnswerMock } = vi.hoisted(() => ({
  streamAnswerMock: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  getLlmClient: () => ({ streamAnswer: streamAnswerMock }),
}));

import { POST } from "@/app/api/chat/route";

const PAGES = ["page 1", "page 2"];

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function* fromChunks(chunks: string[]): AsyncIterable<string> {
  for (const c of chunks) yield c;
}

beforeEach(() => {
  streamAnswerMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/chat", () => {
  it("400 si le body manque des champs requis", async () => {
    const res = await POST(makeRequest({ pages: PAGES }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Paramètres invalides.");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("400 si la question dépasse la longueur max", async () => {
    const res = await POST(makeRequest({ pages: PAGES, question: "x".repeat(5000) }));
    expect(res.status).toBe(400);
  });

  it("400 si l'historique dépasse le nombre max de tours", async () => {
    const history = Array.from({ length: 25 }, () => ({ role: "user", content: "hi" }));
    const res = await POST(makeRequest({ pages: PAGES, question: "q", history }));
    expect(res.status).toBe(400);
  });

  it("400 si le tableau de pages est vide", async () => {
    const res = await POST(makeRequest({ pages: [], question: "q" }));
    expect(res.status).toBe(400);
  });

  it("mode complet par défaut : envoie toutes les pages avec leurs index", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: fromChunks(["Hello", ", ", "world"]),
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-gemini-model")).toBe("gemini-2.5-flash-lite");
    const body = await res.text();
    expect(body).toBe("Hello, world");

    expect(streamAnswerMock).toHaveBeenCalledWith({
      pages: [
        { index: 0, text: "page 1" },
        { index: 1, text: "page 2" },
      ],
      history: [],
      question: "q",
    });
  });

  it("recherche ciblée : BM25 sélectionne les pages pertinentes et préserve les index", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: fromChunks(["ok"]),
    });

    const ragPages = [
      "article général sur le travail",
      "préavis de démission pour les cadres",
      "congés payés",
    ];
    const res = await POST(
      makeRequest({
        pages: ragPages,
        ragEnabled: true,
        question: "préavis cadre",
      }),
    );
    await res.text();

    const call = streamAnswerMock.mock.calls[0]?.[0];
    // La page 1 contient les deux termes rares de la question, donc en tête.
    expect(call.pages[0]).toEqual({ index: 1, text: "préavis de démission pour les cadres" });
    expect(call.pages.length).toBeGreaterThanOrEqual(1);
  });

  it("recherche ciblée : fallback mode complet si aucun match BM25", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: fromChunks(["ok"]),
    });

    const res = await POST(
      makeRequest({
        pages: PAGES,
        ragEnabled: true,
        question: "xyz123",
      }),
    );
    await res.text();

    const call = streamAnswerMock.mock.calls[0]?.[0];
    expect(call.pages).toHaveLength(2);
  });

  it("passe un historique valide au llm", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: fromChunks(["ok"]),
    });

    const history = [
      { role: "user", content: "prev q" },
      { role: "assistant", content: "prev a" },
    ];
    const res = await POST(makeRequest({ pages: PAGES, question: "q", history }));
    await res.text();
    expect(streamAnswerMock).toHaveBeenCalledWith(expect.objectContaining({ history }));
  });

  it("ajoute un message quota formaté quand LlmQuotaError survient en cours de stream", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: (async function* () {
        yield "partial";
        throw new LlmQuotaError("quota exhausted", 43);
      })(),
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("partial");
    expect(body).toContain("Quota Gemini épuisé");
    expect(body).toContain("43s");
  });

  it("stream un message quota si tous les modèles sont épuisés avant le premier chunk", async () => {
    streamAnswerMock.mockRejectedValue(new LlmQuotaError("all exhausted", null));
    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Quota Gemini épuisé");
  });

  it("ajoute un message transitoire si LlmTransientError", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: {
        [Symbol.asyncIterator]() {
          return {
            next: () => Promise.reject(new LlmTransientError("upstream 503")),
          };
        },
      },
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Erreur transitoire");
  });

  it("ajoute un message d'erreur générique sur échec non-429", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: {
        [Symbol.asyncIterator]() {
          return {
            next: () => Promise.reject(new Error("boom")),
          };
        },
      },
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Erreur lors de la génération");
  });

  it("500 si le body n'est pas du JSON valide", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
