import { createGeminiClient } from "@/lib/gemini";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ContextPage = { index: number; text: string };

export type StreamAnswerOptions = {
  pages: ContextPage[];
  history: ChatTurn[];
  question: string;
};

export type StreamResult = {
  model: string;
  chunks: AsyncIterable<string>;
};

export interface LlmClient {
  streamAnswer(opts: StreamAnswerOptions): Promise<StreamResult>;
}

let cached: LlmClient | null = null;

export function getLlmClient(): LlmClient {
  if (!cached) cached = createGeminiClient();
  return cached;
}
