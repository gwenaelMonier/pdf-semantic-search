import type { EmbedContentResponse } from "@google/generative-ai";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { getEnv } from "@/lib/env";
import { LlmQuotaError, normalizeLlmError } from "@/lib/llm-errors";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

function getEmbeddingModel() {
  const env = getEnv();
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedOnce(
  model: ReturnType<typeof getEmbeddingModel>,
  text: string,
  taskType: TaskType,
): Promise<EmbedContentResponse> {
  let attempt = 0;
  while (true) {
    try {
      return await model.embedContent({
        content: { role: "user", parts: [{ text }] },
        taskType,
      });
    } catch (err) {
      const normalized = normalizeLlmError(err);
      const isQuota = normalized instanceof LlmQuotaError;
      if (!isQuota || attempt >= MAX_RETRIES) throw normalized;
      const wait = (normalized.retryAfterSeconds ?? 0) * 1000 || BASE_BACKOFF_MS * 2 ** attempt;
      await sleep(wait);
      attempt++;
    }
  }
}

export async function embedDocument(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getEmbeddingModel();
  const results: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const chunk = texts.slice(i, i + CONCURRENCY);
    const responses = await Promise.all(
      chunk.map((text) => embedOnce(model, text, TaskType.RETRIEVAL_DOCUMENT)),
    );
    responses.forEach((r, j) => {
      results[i + j] = r.embedding.values;
    });
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const response = await embedOnce(model, text, TaskType.RETRIEVAL_QUERY);
  return response.embedding.values;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensions incompatibles: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function topKPages(
  pageEmbeddings: number[][],
  queryEmbedding: number[],
  k: number,
): number[] {
  const scored = pageEmbeddings.map((emb, index) => ({
    index,
    score: cosineSimilarity(emb, queryEmbedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(k, scored.length)).map((s) => s.index);
}
