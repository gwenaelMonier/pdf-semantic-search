import { describe, expect, it } from "vitest";
import { cosineSimilarity, topKPages } from "@/lib/embeddings";

describe("cosineSimilarity", () => {
  it("retourne 1 pour deux vecteurs identiques", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("retourne 0 pour deux vecteurs orthogonaux", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("retourne -1 pour deux vecteurs opposés", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 10);
  });

  it("est insensible à la norme (colinéaires = 1)", () => {
    expect(cosineSimilarity([2, 4, 6], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("retourne 0 quand un vecteur est nul", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("lève une erreur si les dimensions diffèrent", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/Dimensions/);
  });
});

describe("topKPages", () => {
  it("retourne les k indices les plus similaires, triés par pertinence", () => {
    // Query = [1, 0] → favorise les pages alignées sur l'axe X.
    const pages = [
      [0, 1], // page 0 : orthogonal (score 0)
      [1, 0], // page 1 : identique (score 1)
      [0.5, 0.5], // page 2 : ~0.707
      [-1, 0], // page 3 : opposé (-1)
    ];
    const query = [1, 0];
    expect(topKPages(pages, query, 3)).toEqual([1, 2, 0]);
  });

  it("retourne tous les indices si k > nombre de pages", () => {
    const pages = [
      [1, 0],
      [0, 1],
    ];
    const query = [1, 1];
    const result = topKPages(pages, query, 10);
    expect(result).toHaveLength(2);
    expect(result.sort()).toEqual([0, 1]);
  });

  it("retourne un tableau vide si pas de pages", () => {
    expect(topKPages([], [1, 2, 3], 5)).toEqual([]);
  });

  it("respecte k = 1", () => {
    const pages = [
      [0.1, 0.9],
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    const query = [1, 0];
    expect(topKPages(pages, query, 1)).toEqual([1]);
  });
});
