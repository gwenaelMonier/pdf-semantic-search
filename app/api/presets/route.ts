import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "presets");
    const entries = await readdir(dir);
    const pdfs = entries
      .filter((e) => e.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => a.localeCompare(b, "fr"));
    return NextResponse.json({ presets: pdfs });
  } catch {
    return NextResponse.json({ presets: [] });
  }
}
