const K1 = 1.5;
const B = 0.75;
const MIN_TOKEN_LEN = 2;

export type Bm25Index = {
  docLengths: number[];
  avgDocLength: number;
  // term -> Map(docId -> termFreq)
  postings: Map<string, Map<number, number>>;
  // term -> nombre de docs contenant ce terme
  docFreqs: Map<string, number>;
  totalDocs: number;
};

function stem(token: string): string {
  // Strip plural 's' only when preceded by a vowel, r, or n (cadres→cadre, démissions→démission, ingénieurs→ingénieur)
  // Avoids corrupting words that legitimately end in 's' (préavis, fois, bois…)
  if (token.length > 4 && token.endsWith("s") && /[enrtd]s$/.test(token)) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN)
    .map(stem);
}

export function buildIndex(docs: string[]): Bm25Index {
  const postings = new Map<string, Map<number, number>>();
  const docFreqs = new Map<string, number>();
  const docLengths: number[] = new Array(docs.length);
  let totalLength = 0;

  docs.forEach((doc, docId) => {
    const tokens = tokenize(doc);
    docLengths[docId] = tokens.length;
    totalLength += tokens.length;

    const localFreqs = new Map<string, number>();
    for (const token of tokens) {
      localFreqs.set(token, (localFreqs.get(token) ?? 0) + 1);
    }
    for (const [term, tf] of localFreqs) {
      let termPostings = postings.get(term);
      if (!termPostings) {
        termPostings = new Map();
        postings.set(term, termPostings);
      }
      termPostings.set(docId, tf);
      docFreqs.set(term, (docFreqs.get(term) ?? 0) + 1);
    }
  });

  const avgDocLength = docs.length > 0 ? totalLength / docs.length : 0;
  return { docLengths, avgDocLength, postings, docFreqs, totalDocs: docs.length };
}

export function scoreQuery(index: Bm25Index, query: string): Map<number, number> {
  const scores = new Map<number, number>();
  if (index.totalDocs === 0 || index.avgDocLength === 0) return scores;

  const queryTerms = tokenize(query);
  for (const term of queryTerms) {
    const df = index.docFreqs.get(term);
    if (!df) continue;
    const idf = Math.log((index.totalDocs - df + 0.5) / (df + 0.5) + 1);
    const termPostings = index.postings.get(term);
    if (!termPostings) continue;
    for (const [docId, tf] of termPostings) {
      const docLen = index.docLengths[docId];
      const norm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen) / index.avgDocLength));
      scores.set(docId, (scores.get(docId) ?? 0) + idf * norm);
    }
  }
  return scores;
}

export function topKPages(index: Bm25Index, query: string, k: number): number[] {
  const scores = scoreQuery(index, query);
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, Math.min(k, sorted.length)).map(([docId]) => docId);
}
