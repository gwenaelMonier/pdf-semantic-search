import { type Content, GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";
import type { LlmClient, StreamAnswerOptions } from "@/lib/llm";
import { normalizeLlmError } from "@/lib/llm-errors";
import { HR_SYSTEM_PROMPT } from "@/lib/prompts/system";

function buildDocumentContext(pages: string[]): string {
  return pages.map((text, i) => `[PAGE ${i + 1}]\n${text}\n[/PAGE ${i + 1}]`).join("\n\n");
}

export function createGeminiClient(): LlmClient {
  return {
    async *streamAnswer(opts: StreamAnswerOptions): AsyncIterable<string> {
      try {
        const env = getEnv();
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: env.GEMINI_MODEL,
          systemInstruction: HR_SYSTEM_PROMPT,
        });

        const doc = buildDocumentContext(opts.pages);

        const historyContents: Content[] = opts.history.map((t) => ({
          role: t.role === "user" ? "user" : "model",
          parts: [{ text: t.content }],
        }));

        const userText = `=== DOCUMENT ===\n${doc}\n=== FIN DOCUMENT ===\n\nQuestion: ${opts.question}`;

        const chat = model.startChat({ history: historyContents });
        const result = await chat.sendMessageStream(userText);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      } catch (err) {
        throw normalizeLlmError(err);
      }
    },
  };
}
