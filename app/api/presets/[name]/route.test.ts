import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  readdir: vi.fn(),
}));

import { GET } from "@/app/api/presets/[name]/route";

function call(name: string) {
  const req = new Request(`http://localhost/api/presets/${encodeURIComponent(name)}`);
  return GET(req, { params: Promise.resolve({ name: encodeURIComponent(name) }) });
}

beforeEach(() => {
  readFileMock.mockReset();
});

describe("GET /api/presets/[name]", () => {
  it("serves a PDF when the name is safe and the file exists", async () => {
    readFileMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
    const res = await call("doc.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain('filename="doc.pdf"');
    const body = await res.arrayBuffer();
    expect(new TextDecoder().decode(body)).toContain("%PDF-1.4");
  });

  it("404 when the name contains path traversal", async () => {
    const res = await call("../secret.pdf");
    expect(res.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("404 when the name is not a .pdf", async () => {
    const res = await call("doc.txt");
    expect(res.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("404 when the file cannot be read", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));
    const res = await call("missing.pdf");
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/);
  });
});
