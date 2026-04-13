import { createGeminiClient } from "@/lib/gemini";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StreamAnswerOptions = {
  pages: string[];
  history: ChatTurn[];
  question: string;
};

export interface LlmClient {
  streamAnswer(opts: StreamAnswerOptions): AsyncIterable<string>;
}

let cached: LlmClient | null = null;

export function getLlmClient(): LlmClient {
  if (!cached) cached = createGeminiClient();
  return cached;
}
