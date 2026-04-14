import { type NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 30 MB)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { pages, pageCount } = await extractPdfPages(buffer);

    if (pageCount > MAX_PAGES) {
      return NextResponse.json(
        { error: `PDF too long (${pageCount} pages, max ${MAX_PAGES}).` },
        { status: 400 },
      );
    }

    return NextResponse.json({
      pages,
      filename: file.name,
      pageCount,
    });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json({ error: "Error processing PDF." }, { status: 500 });
  }
}
