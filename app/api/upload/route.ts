import { type NextRequest, NextResponse } from "next/server";
import { embedDocument } from "@/lib/embeddings";
import { extractPdfPages } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_PAGES = 500;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF trop volumineux (max 30 Mo)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { pages, pageCount } = await extractPdfPages(buffer);

    if (pageCount > MAX_PAGES) {
      return NextResponse.json(
        { error: `PDF trop long (${pageCount} pages, max ${MAX_PAGES}).` },
        { status: 400 },
      );
    }

    const embedStart = Date.now();
    let embeddings: number[][] | null = null;
    try {
      embeddings = await embedDocument(pages);
      console.log(`[upload] embedded ${pageCount} pages in ${Date.now() - embedStart}ms`);
    } catch (err) {
      console.warn("[upload] embedding failed, mode rapide indisponible:", err);
    }

    return NextResponse.json({
      pages,
      embeddings,
      filename: file.name,
      pageCount,
    });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json({ error: "Erreur lors du traitement du PDF." }, { status: 500 });
  }
}
