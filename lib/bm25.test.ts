import { describe, expect, it } from "vitest";
import { buildIndex, scoreQuery, tokenize, topKPages } from "@/lib/bm25";

describe("tokenize", () => {
  it("minuscule + strip accents + filtre mots de 1 caractère", () => {
    expect(tokenize("Préavis Démission !")).toEqual(["preavis", "demission"]);
  });

  it("découpe sur caractères non-alphanumériques", () => {
    expect(tokenize("art. 12.3-bis")).toEqual(["art", "12", "bis"]);
  });

  it("retourne un tableau vide pour texte vide", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("buildIndex", () => {
  it("calcule correctement doc-freq et longueurs", () => {
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

  it("gère un corpus vide", () => {
    const index = buildIndex([]);
    expect(index.totalDocs).toBe(0);
    expect(index.avgDocLength).toBe(0);
  });
});

describe("scoreQuery", () => {
  it("favorise les docs contenant des termes rares", () => {
    const docs = [
      "préavis de démission pour cadre",
      "article général sur le travail",
      "le préavis",
    ];
    const index = buildIndex(docs);
    const scores = scoreQuery(index, "préavis cadre");
    // doc 0 contient les deux termes rares → score le plus haut
    expect(scores.get(0)).toBeGreaterThan(scores.get(2) ?? 0);
    expect(scores.get(2)).toBeGreaterThan(scores.get(1) ?? -Infinity);
  });

  it("ignore les termes absents du corpus", () => {
    const docs = ["convention collective"];
    const index = buildIndex(docs);
    const scores = scoreQuery(index, "xyz123");
    expect(scores.size).toBe(0);
  });

  it("retourne une map vide sur corpus vide", () => {
    const index = buildIndex([]);
    expect(scoreQuery(index, "préavis").size).toBe(0);
  });
});

describe("topKPages", () => {
  it("retourne les k documents les plus pertinents triés", () => {
    const docs = ["congés payés", "préavis démission cadre", "préavis", "ancienneté"];
    const index = buildIndex(docs);
    const top = topKPages(index, "préavis cadre", 2);
    expect(top).toEqual([1, 2]);
  });

  it("respecte k supérieur au nombre de docs pertinents", () => {
    const docs = ["alpha", "beta", "gamma"];
    const index = buildIndex(docs);
    const top = topKPages(index, "alpha", 10);
    expect(top).toEqual([0]);
  });

  it("retourne un tableau vide si aucun terme ne matche", () => {
    const docs = ["alpha", "beta"];
    const index = buildIndex(docs);
    expect(topKPages(index, "zzz", 5)).toEqual([]);
  });
});
