import { extractText, getDocumentProxy } from "unpdf";

export type PdfExtraction = {
  pages: string[];
  pageCount: number;
};

export async function extractPdfPages(buffer: Buffer): Promise<PdfExtraction> {
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t) =>
    t.replace(/\s+/g, " ").trim(),
  );
  return { pages, pageCount: pages.length };
}
