import { describe, expect, it } from "vitest";
import { createInMemorySessionStore } from "@/lib/session";

function makeStore(
  overrides: { now?: () => number; ttlMs?: number; maxEntries?: number; ids?: string[] } = {},
) {
  const ids = overrides.ids ?? [];
  let cursor = 0;
  return createInMemorySessionStore({
    now: overrides.now,
    ttlMs: overrides.ttlMs,
    maxEntries: overrides.maxEntries,
    idFactory: () => ids[cursor++] ?? `auto-${cursor}`,
  });
}

describe("InMemorySessionStore", () => {
  it("creates a session and retrieves it by id", () => {
    const store = makeStore({ ids: ["s1"] });
    const session = store.create("doc.pdf", ["page 1", "page 2"]);
    expect(session.id).toBe("s1");
    expect(session.filename).toBe("doc.pdf");
    expect(session.pageCount).toBe(2);

    const fetched = store.get("s1");
    expect(fetched?.id).toBe("s1");
    expect(fetched?.pages).toEqual(["page 1", "page 2"]);
  });

  it("returns undefined for unknown ids", () => {
    const store = makeStore();
    expect(store.get("nope")).toBeUndefined();
  });

  it("expires sessions past the TTL and removes them from the store", () => {
    let t = 1_000;
    const store = makeStore({ now: () => t, ttlMs: 100, ids: ["old"] });

    store.create("a.pdf", ["x"]);
    expect(store.get("old")?.filename).toBe("a.pdf");

    t = 1_200; // 200ms later, past TTL of 100ms
    expect(store.get("old")).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("GCs expired entries on create", () => {
    let t = 0;
    const store = makeStore({
      now: () => t,
      ttlMs: 100,
      ids: ["expired", "fresh"],
    });

    store.create("a.pdf", ["x"]);
    t = 500; // 'expired' now past TTL
    store.create("b.pdf", ["y"]);

    expect(store.size()).toBe(1);
    expect(store.get("expired")).toBeUndefined();
    expect(store.get("fresh")?.filename).toBe("b.pdf");
  });

  it("evicts oldest entry when maxEntries is reached", () => {
    const store = makeStore({ maxEntries: 2, ids: ["a", "b", "c"] });
    store.create("a.pdf", ["1"]);
    store.create("b.pdf", ["2"]);
    store.create("c.pdf", ["3"]);

    expect(store.size()).toBe(2);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")?.filename).toBe("b.pdf");
    expect(store.get("c")?.filename).toBe("c.pdf");
  });

  it("delete removes a session", () => {
    const store = makeStore({ ids: ["s"] });
    store.create("a.pdf", ["x"]);
    store.delete("s");
    expect(store.get("s")).toBeUndefined();
    expect(store.size()).toBe(0);
  });
});
