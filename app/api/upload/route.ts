import { type NextRequest, NextResponse } from "next/server";
import { extractPdfPages } from "@/lib/pdf";
import { createSession } from "@/lib/session";

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

    const session = createSession(file.name, pages);
    return NextResponse.json({
      sessionId: session.id,
      filename: session.filename,
      pageCount: session.pageCount,
    });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json({ error: "Erreur lors du traitement du PDF." }, { status: 500 });
  }
}
