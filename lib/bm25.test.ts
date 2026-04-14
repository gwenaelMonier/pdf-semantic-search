import { describe, expect, it } from "vitest";
import { buildIndex, scoreQuery, tokenize, topKPages } from "@/lib/bm25";

describe("tokenize", () => {
  it("lowercases, strips accents and filters 1-character words", () => {
    expect(tokenize("Préavis Démission !")).toEqual(["preavis", "demission"]);
  });

  it("splits on non-alphanumeric characters", () => {
    expect(tokenize("art. 12.3-bis")).toEqual(["art", "12", "bis"]);
  });

  it("returns an empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("buildIndex", () => {
  it("correctly computes doc-freq and lengths", () => {
    const docs = ["le préavis est long", "le préavis du cadre"];
    const index = buildIndex(docs);
    expect(index.totalDocs).toBe(2);
    expect(index.docLengths).toEqual([4, 4]);
    expect(index.avgDocLength).toBe(4);
    expect(index.docFreqs.get("preavis")).toBe(2);
    expect(index.docFreqs.get("cadre")).toBe(1);
    expect(index.postings.get("preavis")?.get(0)).toBe(1);
    expect(index.postings.get("preavis")?.get(1)).toBe(1);
  });

  it("handles an empty corpus", () => {
    const index = buildIndex([]);
    expect(index.totalDocs).toBe(0);
    expect(index.avgDocLength).toBe(0);
  });
});

describe("scoreQuery", () => {
  it("favors docs containing rare terms", () => {
    const docs = [
      "préavis de démission pour cadre",
      "article général sur le travail",
      "le préavis",
    ];
    const index = buildIndex(docs);
    const scores = scoreQuery(index, "préavis cadre");
    // doc 0 contains both rare terms → highest score
    expect(scores.get(0)).toBeGreaterThan(scores.get(2) ?? 0);
    expect(scores.get(2)).toBeGreaterThan(scores.get(1) ?? -Infinity);
  });

  it("ignores terms absent from the corpus", () => {
    const docs = ["convention collective"];
    const index = buildIndex(docs);
    const scores = scoreQuery(index, "xyz123");
    expect(scores.size).toBe(0);
  });

  it("returns an empty map on empty corpus", () => {
    const index = buildIndex([]);
    expect(scoreQuery(index, "préavis").size).toBe(0);
  });
});

describe("topKPages", () => {
  it("returns the k most relevant documents sorted", () => {
    const docs = ["congés payés", "préavis démission cadre", "préavis", "ancienneté"];
    const index = buildIndex(docs);
    const top = topKPages(index, "préavis cadre", 2);
    expect(top).toEqual([1, 2]);
  });

  it("handles k larger than the number of relevant docs", () => {
    const docs = ["alpha", "beta", "gamma"];
    const index = buildIndex(docs);
    const top = topKPages(index, "alpha", 10);
    expect(top).toEqual([0]);
  });

  it("returns an empty array when no term matches", () => {
    const docs = ["alpha", "beta"];
    const index = buildIndex(docs);
    expect(topKPages(index, "zzz", 5)).toEqual([]);
  });
});
