import { type CitationTarget, parseCitations } from "@/lib/citations";

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citation"; targets: CitationTarget[] };

/**
 * Splits a markdown text chunk into alternating text and citation segments
 * based on recognised [p. X: "quote"] markers. Pure function — no React.
 */
export function splitByCitations(text: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const citations = parseCitations(text);
  let lastIndex = 0;

  for (const c of citations) {
    if (c.start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, c.start) });
    }
    segments.push({ type: "citation", targets: c.targets });
    lastIndex = c.end;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}
