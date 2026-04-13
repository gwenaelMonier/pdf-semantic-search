export type PdfTextItem = { str?: string };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTrigrams(norm: string): string[] {
  if (!norm) return [];
  const words = norm.split(" ");
  if (words.length < 3) return [norm];
  const trigrams: string[] = [];
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.push(words.slice(i, i + 3).join(" "));
  }
  return trigrams;
}

export type HighlightResult = {
  indices: Set<number>;
  matched: boolean;
  strategy: "exact" | "trigram" | "none";
};

/**
 * Given the text items of a PDF page and a target quote, returns the set of
 * item indices that overlap the quote's location on the page.
 *
 * Strategy:
 * 1. Normalize every item and concatenate with single-space separators,
 *    tracking each item's char range in the concatenated string.
 * 2. Find the normalized quote as a substring of the concatenated text.
 * 3. Mark every item whose range overlaps the quote's range.
 *
 * Fallback (when exact substring match fails, e.g. the LLM reformulated the
 * quote): trigram scan — mark any item that contains a normalized trigram
 * from the quote, plus immediate neighbours to bridge single-word items.
 */
export function findHighlight(items: PdfTextItem[], quote: string): HighlightResult {
  const indices = new Set<number>();
  const normQuote = normalize(quote);
  if (!normQuote) return { indices, matched: false, strategy: "none" };

  const itemRanges: { idx: number; start: number; end: number }[] = [];
  let concat = "";
  items.forEach((item, idx) => {
    const n = normalize(item.str ?? "");
    if (!n) return;
    if (concat.length > 0) concat += " ";
    const start = concat.length;
    concat += n;
    itemRanges.push({ idx, start, end: concat.length });
  });

  const pos = concat.indexOf(normQuote);
  if (pos !== -1) {
    const quoteEnd = pos + normQuote.length;
    for (const r of itemRanges) {
      if (r.end > pos && r.start < quoteEnd) indices.add(r.idx);
    }
    return { indices, matched: indices.size > 0, strategy: "exact" };
  }

  const trigrams = buildTrigrams(normQuote);
  if (trigrams.length === 0) return { indices, matched: false, strategy: "none" };

  const hits: number[] = [];
  itemRanges.forEach((r, listIdx) => {
    const n = concat.slice(r.start, r.end);
    if (trigrams.some((t) => n.includes(t) || t.includes(n))) {
      hits.push(listIdx);
    }
  });
  for (let i = 0; i < hits.length; i++) {
    indices.add(itemRanges[hits[i]].idx);
    if (i < hits.length - 1) {
      const gap = hits[i + 1] - hits[i];
      if (gap <= 3) {
        for (let j = hits[i] + 1; j < hits[i + 1]; j++) {
          indices.add(itemRanges[j].idx);
        }
      }
    }
  }
  return {
    indices,
    matched: indices.size > 0,
    strategy: indices.size > 0 ? "trigram" : "none",
  };
}
