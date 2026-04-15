export type CitationTarget = { page: number; quote?: string };

export type ParsedCitation = {
  start: number;
  end: number;
  raw: string;
  targets: CitationTarget[];
};

// Matches any [p. ...] bracket — inner content parsed separately.
export const CITATION_REGEX = /\[p\.([^\]]*)\]/g;

const MAX_RANGE_SPAN = 50;

export function expandPageList(raw: string): number[] {
  const pages = new Set<number>();
  for (const seg of raw.split(",")) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      // Segment looks like a range: accept it only if valid, never fall
      // through to single-page parsing (which would half-parse "12-10" as 12).
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      if (
        !Number.isNaN(start) &&
        !Number.isNaN(end) &&
        end >= start &&
        end - start < MAX_RANGE_SPAN
      ) {
        for (let p = start; p <= end; p++) pages.add(p);
      }
      continue;
    }
    if (/^\d+$/.test(trimmed)) {
      pages.add(Number.parseInt(trimmed, 10));
    }
  }
  return [...pages].sort((a, b) => a - b);
}

// Multi-pair format: [p. 8: "q1", p. 9: "q2"] — each page has its own quote.
function parseMultiPair(inner: string): CitationTarget[] {
  const targets: CitationTarget[] = [];
  // Match each optional "p." prefix + page spec + quote
  const pairRe = /(?:p\.\s*)?([\d,\s\-–]+)\s*:\s*"([^"]+)"/g;
  for (const m of inner.matchAll(pairRe)) {
    const pages = expandPageList(m[1]);
    const quote = m[2];
    for (const page of pages) targets.push({ page, quote });
  }
  return targets;
}

// Single-group format: [p. 12: "q1", "q2"] or [p. 12, 34] or [p. 52-53].
function parseSingleGroup(inner: string): CitationTarget[] {
  const withQuote = inner.match(
    /^\s*([\d,\s\-–]+)\s*:\s*((?:"[^"]+"(?:\s*,\s*"[^"]+")*)\s*)$/,
  );
  if (withQuote) {
    const pages = expandPageList(withQuote[1]);
    const quotes = [...withQuote[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    return pages.flatMap((page) => quotes.map((quote) => ({ page, quote })));
  }
  // Page list only — strip any non-page characters before parsing.
  const pages = expandPageList(inner.replace(/[^\d,\s\-–]/g, " ").trim());
  return pages.map((page) => ({ page }));
}

export function parseCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  const re = new RegExp(CITATION_REGEX.source, CITATION_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const inner = match[1]; // everything after "p." inside the brackets

    // Multi-pair: [p. 8: "q1", p. 9: "q2"]
    const isMultiPair = /"\s*,\s*p\./.test(inner);
    const targets = isMultiPair ? parseMultiPair(inner) : parseSingleGroup(inner);

    if (targets.length === 0) continue;
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      targets,
    });
  }
  return out;
}
