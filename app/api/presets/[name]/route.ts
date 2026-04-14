import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PRESETS_DIR = path.join(process.cwd(), "collective-agreement");
const SAFE_NAME = /^[\w\-. ]+\.pdf$/;

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);

  if (!SAFE_NAME.test(name) || name.includes("..")) {
    return NextResponse.json({ error: "Invalid name." }, { status: 404 });
  }

  const target = path.resolve(PRESETS_DIR, name);
  if (!target.startsWith(PRESETS_DIR + path.sep)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 404 });
  }

  try {
    const buf = await readFile(target);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
