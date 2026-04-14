import { type Content, GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";
import type { LlmClient, StreamAnswerOptions, StreamResult } from "@/lib/llm";
import { LlmQuotaError, normalizeLlmError } from "@/lib/llm-errors";
import { HR_SYSTEM_PROMPT } from "@/lib/prompts/system";

export const ROTATION_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

function buildDocumentContext(pages: { index: number; text: string }[]): string {
  return pages
    .map(({ index, text }) => `[PAGE ${index + 1}]\n${text}\n[/PAGE ${index + 1}]`)
    .join("\n\n");
}

export function createGeminiClient(): LlmClient {
  return {
    async streamAnswer(opts: StreamAnswerOptions): Promise<StreamResult> {
      const env = getEnv();
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

      const startModel = env.GEMINI_MODEL ?? ROTATION_MODELS[0];
      const startIdx = ROTATION_MODELS.indexOf(startModel as (typeof ROTATION_MODELS)[number]);
      const models: string[] =
        startIdx >= 0
          ? [...ROTATION_MODELS.slice(startIdx), ...ROTATION_MODELS.slice(0, startIdx)]
          : [startModel, ...ROTATION_MODELS.filter((m) => m !== startModel)];

      const doc = buildDocumentContext(opts.pages);
      const historyContents: Content[] = opts.history.map((t) => ({
        role: t.role === "user" ? "user" : "model",
        parts: [{ text: t.content }],
      }));
      const userText = `=== DOCUMENT ===\n${doc}\n=== FIN DOCUMENT ===\n\nQuestion: ${opts.question}`;

      for (const modelId of models) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelId,
            systemInstruction: HR_SYSTEM_PROMPT,
          });
          const chat = model.startChat({ history: historyContents });
          const result = await chat.sendMessageStream(userText);
          console.log(`[gemini] selected model: ${modelId}`);
          const chunks = async function* () {
            try {
              for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) yield text;
              }
            } catch (err) {
              throw normalizeLlmError(err);
            }
          };
          return { model: modelId, chunks: chunks() };
        } catch (err) {
          const normalized = normalizeLlmError(err);
          const status = (err as { status?: number })?.status;
          if (normalized instanceof LlmQuotaError || status === 404) {
            console.warn(`[gemini] ${modelId} skipped (${status ?? 429}), trying next model`);
            continue;
          }
          console.error(`[gemini] ${modelId} failed:`, normalized.message);
          throw normalized;
        }
      }

      console.error("[gemini] all models exhausted");
      throw new LlmQuotaError("Tous les modèles Gemini sont à court de quota", null);
    },
  };
}
