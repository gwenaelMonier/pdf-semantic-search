import { describe, expect, it } from "vitest";
import { LlmError, LlmQuotaError, LlmTransientError, normalizeLlmError } from "@/lib/llm-errors";

describe("normalizeLlmError", () => {
  it("passes through existing LlmError instances", () => {
    const original = new LlmQuotaError("q", 10);
    expect(normalizeLlmError(original)).toBe(original);
  });

  it("maps status 429 to LlmQuotaError and parses retry-after", () => {
    const err = normalizeLlmError({ status: 429, message: "quota exhausted, retry in 42.5s" });
    expect(err).toBeInstanceOf(LlmQuotaError);
    expect((err as LlmQuotaError).retryAfterSeconds).toBe(43);
  });

  it("maps status 429 without retry hint to null retryAfterSeconds", () => {
    const err = normalizeLlmError({ status: 429, message: "quota exhausted" });
    expect(err).toBeInstanceOf(LlmQuotaError);
    expect((err as LlmQuotaError).retryAfterSeconds).toBeNull();
  });

  it("maps 5xx to LlmTransientError", () => {
    const err = normalizeLlmError({ status: 503, message: "service unavailable" });
    expect(err).toBeInstanceOf(LlmTransientError);
    expect(err).not.toBeInstanceOf(LlmQuotaError);
  });

  it("maps other errors to LlmError", () => {
    const err = normalizeLlmError({ status: 400, message: "bad request" });
    expect(err).toBeInstanceOf(LlmError);
    expect(err).not.toBeInstanceOf(LlmQuotaError);
    expect(err).not.toBeInstanceOf(LlmTransientError);
  });

  it("handles non-object errors without crashing", () => {
    const err = normalizeLlmError("string error");
    expect(err).toBeInstanceOf(LlmError);
  });
});
