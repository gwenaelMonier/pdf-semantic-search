import { describe, expect, it } from "vitest";
import { expandPageList, parseCitations } from "./citations";

describe("expandPageList", () => {
  it("parses a single page", () => {
    expect(expandPageList("12")).toEqual([12]);
  });

  it("parses a comma-separated list", () => {
    expect(expandPageList("12, 34, 56")).toEqual([12, 34, 56]);
  });

  it("ignores whitespace around items", () => {
    expect(expandPageList("  12  ,   34  ")).toEqual([12, 34]);
  });

  it("expands a simple range", () => {
    expect(expandPageList("10-12")).toEqual([10, 11, 12]);
  });

  it("expands an en-dash range (unicode)", () => {
    expect(expandPageList("10–12")).toEqual([10, 11, 12]);
  });

  it("handles mixed list and range", () => {
    expect(expandPageList("5, 10-12, 20")).toEqual([5, 10, 11, 12, 20]);
  });

  it("deduplicates overlapping ranges", () => {
    expect(expandPageList("10-12, 11-13")).toEqual([10, 11, 12, 13]);
  });

  it("sorts the result", () => {
    expect(expandPageList("30, 5, 15")).toEqual([5, 15, 30]);
  });

  it("rejects reversed ranges", () => {
    expect(expandPageList("12-10")).toEqual([]);
  });

  it("rejects ranges wider than 50 pages", () => {
    expect(expandPageList("10-100")).toEqual([]);
  });

  it("accepts ranges at the 49-page limit", () => {
    const result = expandPageList("1-50");
    expect(result).toHaveLength(50);
    expect(result[0]).toBe(1);
    expect(result[49]).toBe(50);
  });

  it("returns empty for non-numeric input", () => {
    expect(expandPageList("abc")).toEqual([]);
  });

  it("returns empty for empty string", () => {
    expect(expandPageList("")).toEqual([]);
  });
});

describe("parseCitations", () => {
  it("returns empty array when no citations", () => {
    expect(parseCitations("Juste du texte normal.")).toEqual([]);
  });

  it("parses a single-page citation", () => {
    const out = parseCitations("Voir [p. 12] pour plus d'infos.");
    expect(out).toHaveLength(1);
    expect(out[0].targets).toEqual([{ page: 12 }]);
    expect(out[0].raw).toBe("[p. 12]");
  });

  it("parses a multi-page citation", () => {
    const out = parseCitations("Cf. [p. 12, 34, 56].");
    expect(out[0].targets).toEqual([{ page: 12 }, { page: 34 }, { page: 56 }]);
  });

  it("parses a range citation", () => {
    const out = parseCitations("Voir [p. 52-53].");
    expect(out[0].targets).toEqual([{ page: 52 }, { page: 53 }]);
  });

  it("parses a quoted single-page citation", () => {
    const out = parseCitations('Réponse [p. 12: "un extrait important"].');
    expect(out[0].targets).toEqual([{ page: 12, quote: "un extrait important" }]);
  });

  it("parses a quoted range citation and applies quote to each page", () => {
    const out = parseCitations('Cf. [p. 48-49: "DURÉES DES DÉLAIS DE PRÉVENANCE"].');
    expect(out[0].targets).toEqual([
      { page: 48, quote: "DURÉES DES DÉLAIS DE PRÉVENANCE" },
      { page: 49, quote: "DURÉES DES DÉLAIS DE PRÉVENANCE" },
    ]);
  });

  it("parses a quoted list citation", () => {
    const out = parseCitations('Source [p. 10, 12: "court extrait"].');
    expect(out[0].targets).toEqual([
      { page: 10, quote: "court extrait" },
      { page: 12, quote: "court extrait" },
    ]);
  });

  it("parses multiple citations in one text", () => {
    const text = 'A [p. 5: "un"] puis B [p. 10, 11] puis C [p. 20-22].';
    const out = parseCitations(text);
    expect(out).toHaveLength(3);
    expect(out[0].targets[0]).toEqual({ page: 5, quote: "un" });
    expect(out[1].targets).toEqual([{ page: 10 }, { page: 11 }]);
    expect(out[2].targets).toEqual([{ page: 20 }, { page: 21 }, { page: 22 }]);
  });

  it("reports correct start/end offsets", () => {
    const text = "Avant [p. 12] après.";
    const out = parseCitations(text);
    expect(out[0].start).toBe(6);
    expect(out[0].end).toBe(13);
    expect(text.slice(out[0].start, out[0].end)).toBe("[p. 12]");
  });

  it("tolerates extra spaces inside the brackets", () => {
    const out = parseCitations("[p.  12 ,  34 ]");
    expect(out[0].targets).toEqual([{ page: 12 }, { page: 34 }]);
  });

  it("tolerates extra spaces before the colon in quoted form", () => {
    const out = parseCitations('[p. 12 : "extrait"]');
    expect(out[0].targets).toEqual([{ page: 12, quote: "extrait" }]);
  });

  it("does not match malformed citations (missing closing bracket)", () => {
    expect(parseCitations("[p. 12")).toEqual([]);
  });

  it("does not match plain page references without brackets", () => {
    expect(parseCitations("Voir p. 12 pour plus d'infos.")).toEqual([]);
  });

  it("parses a multi-quote citation on one page", () => {
    const out = parseCitations(
      '[p. 49: "Au-delà de 1 mois 48 heures", "Au-delà de 3 mois 48 heures", "Au-delà de 6 mois 48 heures"]',
    );
    expect(out).toHaveLength(1);
    expect(out[0].targets).toEqual([
      { page: 49, quote: "Au-delà de 1 mois 48 heures" },
      { page: 49, quote: "Au-delà de 3 mois 48 heures" },
      { page: 49, quote: "Au-delà de 6 mois 48 heures" },
    ]);
  });

  it("parses multi-quote citation on a page range", () => {
    const out = parseCitations('[p. 48-49: "quote A", "quote B"]');
    expect(out[0].targets).toEqual([
      { page: 48, quote: "quote A" },
      { page: 48, quote: "quote B" },
      { page: 49, quote: "quote A" },
      { page: 49, quote: "quote B" },
    ]);
  });

  it("handles quotes containing punctuation and accents", () => {
    const out = parseCitations("[p. 5: \"à l'initiative de l'employeur : 24 heures\"]");
    expect(out[0].targets[0].quote).toBe("à l'initiative de l'employeur : 24 heures");
  });

  it("is safe to call repeatedly (no regex lastIndex leak)", () => {
    const text = "[p. 1] [p. 2]";
    const first = parseCitations(text);
    const second = parseCitations(text);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
  });
});
