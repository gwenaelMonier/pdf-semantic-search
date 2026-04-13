export type Session = {
  id: string;
  filename: string;
  pages: string[];
  pageCount: number;
  createdAt: number;
};

export interface SessionStore {
  create(filename: string, pages: string[]): Session;
  get(id: string): Session | undefined;
  delete(id: string): void;
  size(): number;
}

export type InMemorySessionStoreOptions = {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
  idFactory?: () => string;
};

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 2; // 2h
const DEFAULT_MAX_ENTRIES = 32;

export function createInMemorySessionStore(opts: InMemorySessionStoreOptions = {}): SessionStore {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = opts.now ?? Date.now;
  const idFactory = opts.idFactory ?? (() => crypto.randomUUID());
  // Map iteration order = insertion order; we leverage it for pseudo-LRU on bound eviction.
  const store = new Map<string, Session>();

  function gc(): void {
    const t = now();
    for (const [id, s] of store) {
      if (t - s.createdAt > ttlMs) store.delete(id);
    }
  }

  function evictOldestIfOverCapacity(): void {
    while (store.size >= maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) return;
      store.delete(oldest);
    }
  }

  return {
    create(filename, pages) {
      gc();
      evictOldestIfOverCapacity();
      const id = idFactory();
      const session: Session = {
        id,
        filename,
        pages,
        pageCount: pages.length,
        createdAt: now(),
      };
      store.set(id, session);
      return session;
    },
    get(id) {
      const s = store.get(id);
      if (!s) return undefined;
      if (now() - s.createdAt > ttlMs) {
        store.delete(id);
        return undefined;
      }
      return s;
    },
    delete(id) {
      store.delete(id);
    },
    size() {
      return store.size;
    },
  };
}

export const sessionStore: SessionStore = createInMemorySessionStore();
