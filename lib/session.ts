type Session = {
  id: string;
  filename: string;
  pages: string[];
  pageCount: number;
  createdAt: number;
};

const store = new Map<string, Session>();
const TTL_MS = 1000 * 60 * 60 * 2; // 2h

function gc() {
  const now = Date.now();
  for (const [id, s] of store) {
    if (now - s.createdAt > TTL_MS) store.delete(id);
  }
}

export function createSession(filename: string, pages: string[]): Session {
  gc();
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    filename,
    pages,
    pageCount: pages.length,
    createdAt: Date.now(),
  };
  store.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}
