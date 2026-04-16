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

function makeResult(chunks: string[]) {
  return { model: "gemini-2.5-flash-lite", chunks: fromChunks(chunks), meta: () => ({}) };
}

beforeEach(() => {
  streamAnswerMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/chat", () => {
  it("400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ pages: PAGES }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid parameters.");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("400 when question exceeds max length", async () => {
    const res = await POST(makeRequest({ pages: PAGES, question: "x".repeat(5000) }));
    expect(res.status).toBe(400);
  });

  it("400 when history exceeds max turns", async () => {
    const history = Array.from({ length: 25 }, () => ({ role: "user", content: "hi" }));
    const res = await POST(makeRequest({ pages: PAGES, question: "q", history }));
    expect(res.status).toBe(400);
  });

  it("400 si le tableau de pages est vide", async () => {
    const res = await POST(makeRequest({ pages: [], question: "q" }));
    expect(res.status).toBe(400);
  });

  it("default full mode: sends all pages with their indices", async () => {
    streamAnswerMock.mockResolvedValue(makeResult(["Hello", ", ", "world"]));

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.slice(0, body.indexOf("\x00") === -1 ? undefined : body.indexOf("\x00"))).toBe(
      "Hello, world",
    );

    expect(streamAnswerMock).toHaveBeenCalledWith({
      pages: [
        { index: 0, text: "page 1" },
        { index: 1, text: "page 2" },
      ],
      history: [],
      question: "q",
    });
  });

  it("token saving: BM25 selects relevant pages and preserves indices", async () => {
    streamAnswerMock.mockResolvedValue(makeResult(["ok"]));

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
    // Page 1 contains both rare query terms, so it ranks first.
    expect(call.pages[0]).toEqual({ index: 1, text: "préavis de démission pour les cadres" });
    expect(call.pages.length).toBeGreaterThanOrEqual(1);
  });

  it("token saving: falls back to full mode when BM25 has no match", async () => {
    streamAnswerMock.mockResolvedValue(makeResult(["ok"]));

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

  it("passes a valid history to the llm", async () => {
    streamAnswerMock.mockResolvedValue(makeResult(["ok"]));

    const history = [
      { role: "user", content: "prev q" },
      { role: "assistant", content: "prev a" },
    ];
    const res = await POST(makeRequest({ pages: PAGES, question: "q", history }));
    await res.text();
    expect(streamAnswerMock).toHaveBeenCalledWith(expect.objectContaining({ history }));
  });

  it("closes stream silently on mid-stream LlmQuotaError, preserving partial content", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: (async function* () {
        yield "partial";
        throw new LlmQuotaError("quota exhausted", 43);
      })(),
      meta: () => ({}),
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("partial");
    // No inline error — client detects missing sentinel and shows retry
    expect(body).not.toContain("Gemini quota exhausted");
    expect(body).not.toContain("\x00"); // no sentinel written on error
  });

  it("streams a quota message when all models are exhausted before the first chunk", async () => {
    streamAnswerMock.mockRejectedValue(new LlmQuotaError("all exhausted", null));
    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Gemini quota exhausted");
  });

  it("closes stream silently on mid-stream LlmTransientError", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: (async function* () {
        yield "partial";
        throw new LlmTransientError("upstream 503");
      })(),
      meta: () => ({}),
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("partial");
    expect(body).not.toContain("Transient");
    expect(body).not.toContain("\x00");
  });

  it("closes stream silently on mid-stream generic error", async () => {
    streamAnswerMock.mockResolvedValue({
      model: "gemini-2.5-flash-lite",
      chunks: (async function* () {
        yield "partial";
        throw new Error("boom");
      })(),
      meta: () => ({}),
    });

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("partial");
    expect(body).not.toContain("Error generating");
    expect(body).not.toContain("\x00");
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
