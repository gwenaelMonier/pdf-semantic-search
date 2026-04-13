import { describe, expect, it } from "vitest";
import { makeMinimalPdf } from "@/lib/__fixtures__/make-pdf";
import { extractPdfPages } from "@/lib/pdf";

describe("extractPdfPages", () => {
  it("extracts the correct number of pages", async () => {
    const buf = makeMinimalPdf(["First page", "Second page"]);
    const result = await extractPdfPages(buf);
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
  });

  it("returns text content from each page", async () => {
    const buf = makeMinimalPdf(["Hello World", "Goodbye World"]);
    const result = await extractPdfPages(buf);
    expect(result.pages[0]).toContain("Hello World");
    expect(result.pages[1]).toContain("Goodbye World");
  });

  it("normalizes whitespace in extracted text", async () => {
    const buf = makeMinimalPdf(["Text   with    spaces"]);
    const result = await extractPdfPages(buf);
    expect(result.pages[0]).not.toMatch(/\s{2,}/);
  });

  it("trims leading and trailing whitespace", async () => {
    const buf = makeMinimalPdf(["Trimmed text"]);
    const result = await extractPdfPages(buf);
    expect(result.pages[0]).toBe(result.pages[0].trim());
  });

  it("pages.length equals pageCount", async () => {
    const buf = makeMinimalPdf(["A", "B", "C"]);
    const result = await extractPdfPages(buf);
    expect(result.pages.length).toBe(result.pageCount);
  });

  it("handles a single-page PDF", async () => {
    const buf = makeMinimalPdf(["Solo"]);
    const result = await extractPdfPages(buf);
    expect(result.pageCount).toBe(1);
    expect(result.pages[0]).toContain("Solo");
  });
});
