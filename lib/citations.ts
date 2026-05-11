export type CitationTarget = { page: number; quote?: string };

export type ParsedCitation = {
  start: number;
  end: number;
  raw: string;
  targets: CitationTarget[];
};

const CITATION_RE = /\[p\.([^\]]*)\]/g;

const MAX_RANGE_SPAN = 50;

export function expandPageList(raw: string): number[] {
  const pages = new Set<number>();
  for (const seg of raw.split(",")) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
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

// Takes everything between the outermost first and last '"', then splits on '", "'
// boundaries. Handles embedded '"' naturally: "titre "sous-titre"" → one item.
function extractQuoteList(s: string): string[] {
  const first = s.indexOf('"');
  const last = s.lastIndexOf('"');
  if (first === -1 || last <= first) return [];
  return s.slice(first + 1, last).split(/"\s*,\s*"/);
}

// Each "PAGES:" occurrence in inner is an anchor. Anchor count drives format:
//   0 anchors → page-list only:  [p. 12, 34]  [p. 52-53]
//   1 anchor  → single-group:    [p. 12: "q"]  [p. 12: "q1", "q2"]
//   ≥2 anchors → multi-pair:     [p. 8: "q1", p. 9: "q2"]
const ANCHOR_RE = /(?:^|,\s*)(?:p\.\s*)?([\d,\s\-–]+)\s*:\s*/g;

function parseInner(inner: string): CitationTarget[] {
  const anchors = [...inner.matchAll(ANCHOR_RE)];

  if (anchors.length === 0) {
    return expandPageList(inner).map((page) => ({ page }));
  }

  if (anchors.length >= 2) {
    const targets: CitationTarget[] = [];
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const pages = expandPageList(anchor[1]);
      const contentStart = (anchor.index ?? 0) + anchor[0].length;
      const contentEnd =
        i + 1 < anchors.length ? (anchors[i + 1].index ?? inner.length) : inner.length;
      const quotes = extractQuoteList(inner.slice(contentStart, contentEnd));
      for (const page of pages) {
        if (quotes.length > 0) {
          for (const quote of quotes) targets.push({ page, quote });
        } else {
          targets.push({ page });
        }
      }
    }
    return targets;
  }

  const anchor = anchors[0];
  const pages = expandPageList(anchor[1]);
  if (pages.length === 0) return [];
  const quoteStr = inner.slice((anchor.index ?? 0) + anchor[0].length).trim();
  const quotes = extractQuoteList(quoteStr);
  if (quotes.length === 0) return pages.map((page) => ({ page }));
  return pages.flatMap((page) => quotes.map((quote) => ({ page, quote })));
}

export function parseCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  const re = new RegExp(CITATION_RE.source, CITATION_RE.flags);
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    const targets = parseInner(match[1]);
    if (targets.length === 0) continue;
    out.push({ start: match.index, end: match.index + match[0].length, raw: match[0], targets });
  }
  return out;
}
