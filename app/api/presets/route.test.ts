import { beforeEach, describe, expect, it, vi } from "vitest";

const { readdirMock } = vi.hoisted(() => ({ readdirMock: vi.fn() }));

vi.mock("node:fs/promises", () => ({
  readdir: readdirMock,
  readFile: vi.fn(),
}));

import { GET } from "@/app/api/presets/route";

beforeEach(() => {
  readdirMock.mockReset();
});

describe("GET /api/presets", () => {
  it("returns sorted PDF filenames", async () => {
    readdirMock.mockResolvedValue(["zebra.pdf", "alpha.pdf", "readme.md", "Bravo.PDF"]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.presets).toEqual(["alpha.pdf", "Bravo.PDF", "zebra.pdf"]);
  });

  it("returns empty list when directory is missing", async () => {
    readdirMock.mockRejectedValue(new Error("ENOENT"));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.presets).toEqual([]);
  });

  it("filters out non-PDF entries", async () => {
    readdirMock.mockResolvedValue(["a.pdf", "b.txt", "c.doc"]);
    const res = await GET();
    const json = await res.json();
    expect(json.presets).toEqual(["a.pdf"]);
  });
});
