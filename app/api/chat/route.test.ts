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
});

describe("POST /api/chat", () => {
  it("400 when body is missing required fields", async () => {
    const res = await POST(makeRequest({ pages: PAGES }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Paramètres invalides.");
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

  it("400 when pages array is empty", async () => {
    const res = await POST(makeRequest({ pages: [], question: "q" }));
    expect(res.status).toBe(400);
  });

  it("streams concatenated chunks on success", async () => {
    streamAnswerMock.mockImplementation(() => fromChunks(["Hello", ", ", "world"]));

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toBe("Hello, world");

    expect(streamAnswerMock).toHaveBeenCalledWith({
      pages: PAGES,
      history: [],
      question: "q",
    });
  });

  it("passes a valid history through to the llm", async () => {
    streamAnswerMock.mockImplementation(() => fromChunks(["ok"]));

    const history = [
      { role: "user", content: "prev q" },
      { role: "assistant", content: "prev a" },
    ];
    const res = await POST(makeRequest({ pages: PAGES, question: "q", history }));
    await res.text();
    expect(streamAnswerMock).toHaveBeenCalledWith(expect.objectContaining({ history }));
  });

  it("appends a formatted quota message when llm throws LlmQuotaError", async () => {
    streamAnswerMock.mockImplementation(() =>
      (async function* () {
        yield "partial";
        throw new LlmQuotaError("quota exhausted", 43);
      })(),
    );

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("partial");
    expect(body).toContain("Quota Gemini épuisé");
    expect(body).toContain("43s");
  });

  it("appends a transient error message when llm throws LlmTransientError", async () => {
    streamAnswerMock.mockImplementation(() => ({
      [Symbol.asyncIterator]() {
        return {
          next: () => Promise.reject(new LlmTransientError("upstream 503")),
        };
      },
    }));

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Erreur transitoire");
  });

  it("appends a generic error message on non-429 failure", async () => {
    streamAnswerMock.mockImplementation(() => ({
      [Symbol.asyncIterator]() {
        return {
          next: () => Promise.reject(new Error("boom")),
        };
      },
    }));

    const res = await POST(makeRequest({ pages: PAGES, question: "q" }));
    const body = await res.text();
    expect(body).toContain("Erreur lors de la génération");
  });

  it("500 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
