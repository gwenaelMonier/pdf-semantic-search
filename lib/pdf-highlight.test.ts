import { describe, expect, it } from "vitest";
import { buildTrigrams, findHighlight, normalize } from "@/lib/pdf-highlight";

describe("normalize", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(normalize("  Éléphant   rosé  ")).toBe("elephant rose");
  });

  it("replaces punctuation with spaces", () => {
    expect(normalize("L'employeur : 24 heures.")).toBe("l employeur 24 heures");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalize("   \n\t  ")).toBe("");
  });
});

describe("buildTrigrams", () => {
  it("returns a single element for short inputs", () => {
    expect(buildTrigrams("un deux")).toEqual(["un deux"]);
  });

  it("builds sliding window trigrams for longer inputs", () => {
    expect(buildTrigrams("un deux trois quatre")).toEqual(["un deux trois", "deux trois quatre"]);
  });

  it("returns empty for empty input", () => {
    expect(buildTrigrams("")).toEqual([]);
  });
});

describe("findHighlight", () => {
  const page = [
    { str: "Article 12." },
    { str: "La durée du travail" },
    { str: "à l'initiative" },
    { str: "de l'employeur" },
    { str: "est fixée à" },
    { str: "24 heures." },
    { str: "Suite du paragraphe." },
  ];

  it("finds an exact match across multiple items", () => {
    const res = findHighlight(page, "à l'initiative de l'employeur");
    expect(res.strategy).toBe("exact");
    expect(res.matched).toBe(true);
    // items 2 ("à l'initiative") and 3 ("de l'employeur")
    expect(res.indices.has(2)).toBe(true);
    expect(res.indices.has(3)).toBe(true);
    expect(res.indices.has(0)).toBe(false);
  });

  it("matches despite punctuation and casing differences", () => {
    const res = findHighlight(page, "A L'INITIATIVE, DE L'EMPLOYEUR!");
    expect(res.matched).toBe(true);
    expect(res.indices.has(2)).toBe(true);
    expect(res.indices.has(3)).toBe(true);
  });

  it("falls back to trigram match when the quote is slightly reformulated", () => {
    // "durée du travail fixée" — 4 words, sliding trigrams will partially hit.
    const res = findHighlight(page, "durée du travail fixée");
    expect(res.strategy).toBe("trigram");
    expect(res.matched).toBe(true);
  });

  it("returns empty result for a blank quote", () => {
    const res = findHighlight(page, "   ");
    expect(res.strategy).toBe("none");
    expect(res.matched).toBe(false);
    expect(res.indices.size).toBe(0);
  });

  it("returns unmatched result when the quote shares nothing with the page", () => {
    const res = findHighlight(page, "autre planète lointaine inconnue");
    expect(res.matched).toBe(false);
    expect(res.strategy).toBe("none");
  });
});
