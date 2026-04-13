import { describe, expect, it } from "vitest";
import { splitByCitations } from "@/lib/citation-segments";

describe("splitByCitations", () => {
  it("returns a single text segment when there are no citations", () => {
    const out = splitByCitations("hello world");
    expect(out).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("splits a text around a single citation marker", () => {
    const out = splitByCitations('before [p. 5: "quote ici"] after');
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ type: "text", value: "before " });
    expect(out[1].type).toBe("citation");
    if (out[1].type === "citation") {
      expect(out[1].targets).toEqual([{ page: 5, quote: "quote ici" }]);
    }
    expect(out[2]).toEqual({ type: "text", value: " after" });
  });

  it("handles multiple citations in one text", () => {
    const out = splitByCitations('A [p. 1: "un"] B [p. 2: "deux"]');
    const types = out.map((s) => s.type);
    expect(types).toEqual(["text", "citation", "text", "citation"]);
  });

  it("handles an empty input", () => {
    expect(splitByCitations("")).toEqual([]);
  });

  it("supports range citations without quotes", () => {
    const out = splitByCitations("[p. 2-4]");
    expect(out).toHaveLength(1);
    if (out[0].type === "citation") {
      expect(out[0].targets.map((t) => t.page)).toEqual([2, 3, 4]);
    }
  });
});
