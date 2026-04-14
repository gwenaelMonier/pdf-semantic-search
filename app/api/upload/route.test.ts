import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { extractPdfPagesMock } = vi.hoisted(() => ({
  extractPdfPagesMock: vi.fn(),
}));

vi.mock("@/lib/pdf", () => ({
  extractPdfPages: extractPdfPagesMock,
}));

import { POST } from "@/app/api/upload/route";

function makeRequest(form: FormData): NextRequest {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  }) as unknown as NextRequest;
}

function pdfFile(name: string, size: number, type = "application/pdf"): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  extractPdfPagesMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/upload", () => {
  it("400 when no file is provided", async () => {
    const res = await POST(makeRequest(new FormData()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Aucun fichier/);
  });

  it("400 when file is not a PDF", async () => {
    const form = new FormData();
    form.append("file", pdfFile("note.txt", 10, "text/plain"));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/doit être un PDF/);
  });

  it("400 when file exceeds 30 MB", async () => {
    const form = new FormData();
    form.append("file", pdfFile("big.pdf", 31 * 1024 * 1024));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/trop volumineux/);
    expect(extractPdfPagesMock).not.toHaveBeenCalled();
  });

  it("400 when PDF exceeds 500 pages", async () => {
    extractPdfPagesMock.mockResolvedValue({
      pages: Array.from({ length: 501 }, () => "x"),
      pageCount: 501,
    });
    const form = new FormData();
    form.append("file", pdfFile("long.pdf", 1024));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/trop long/);
  });

  it("200 retourne pages et métadonnées en cas de succès", async () => {
    extractPdfPagesMock.mockResolvedValue({
      pages: ["page un", "page deux"],
      pageCount: 2,
    });
    const form = new FormData();
    form.append("file", pdfFile("doc.pdf", 2048));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      pages: ["page un", "page deux"],
      filename: "doc.pdf",
      pageCount: 2,
    });
  });

  it("500 when extraction throws", async () => {
    extractPdfPagesMock.mockRejectedValue(new Error("corrupt"));
    const form = new FormData();
    form.append("file", pdfFile("bad.pdf", 1024));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Erreur lors du traitement/);
  });
});
