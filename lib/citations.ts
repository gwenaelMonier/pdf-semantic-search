export type CitationTarget = { page: number; quote?: string };

export type ParsedCitation = {
  start: number;
  end: number;
  raw: string;
  targets: CitationTarget[];
};

// Matches [p. 12: "extrait"] OR [p. 12-14: "extrait"] OR [p. 12, 34] OR [p. 52-53]
export const CITATION_REGEX = /\[p\.\s*([\d,\s\-–]+)\s*:\s*"([^"]+)"\]|\[p\.\s*([\d,\s\-–]+)\]/g;

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

export function parseCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  const re = new RegExp(CITATION_REGEX.source, CITATION_REGEX.flags);
  let match = re.exec(text);
  while (match !== null) {
    const quoted = match[2];
    const pagesRaw = quoted ? match[1] : match[3];
    const pages = expandPageList(pagesRaw);
    if (pages.length === 0) continue;
    const targets: CitationTarget[] = quoted
      ? pages.map((page) => ({ page, quote: quoted }))
      : pages.map((page) => ({ page }));
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      targets,
    });
    match = re.exec(text);
  }
  return out;
}
