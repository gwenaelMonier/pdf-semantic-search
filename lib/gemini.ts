import { type Content, GoogleGenAI } from "@google/genai";
import { getEnv } from "@/lib/env";
import type { LlmClient, StreamAnswerOptions, StreamResult } from "@/lib/llm";
import { LlmQuotaError, normalizeLlmError } from "@/lib/llm-errors";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

export const ROTATION_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  //"gemini-3-flash-preview",
  //"gemini-3.1-flash-lite-preview",
] as const;

function buildDocumentContext(pages: { index: number; text: string }[]): string {
  return pages
    .map(({ index, text }) => `[PAGE ${index + 1}]\n${text}\n[/PAGE ${index + 1}]`)
    .join("\n\n");
}

export function createGeminiClient(): LlmClient {
  return {
    async streamAnswer(opts: StreamAnswerOptions): Promise<StreamResult> {
      const env = getEnv();

      const startModel = env.GEMINI_MODEL ?? ROTATION_MODELS[0];
      const startIdx = ROTATION_MODELS.indexOf(startModel as (typeof ROTATION_MODELS)[number]);
      const models: string[] =
        startIdx >= 0
          ? [...ROTATION_MODELS.slice(startIdx), ...ROTATION_MODELS.slice(0, startIdx)]
          : [startModel, ...ROTATION_MODELS.filter((m) => m !== startModel)];

      const doc = buildDocumentContext(opts.pages);
      const history: Content[] = opts.history.map((t) => ({
        role: t.role === "user" ? "user" : "model",
        parts: [{ text: t.content }],
      }));
      const userText = `=== DOCUMENT ===\n${doc}\n=== FIN DOCUMENT ===\n\nQuestion: ${opts.question}`;

      for (const [keyIdx, apiKey] of env.GEMINI_API_KEYS.entries()) {
        const keyLabel = `key#${keyIdx + 1}`;
        const ai = new GoogleGenAI({ apiKey });

        for (const modelId of models) {
          try {
            const chat = ai.chats.create({
              model: modelId,
              history,
              config: { systemInstruction: SYSTEM_PROMPT },
            });
            const stream = await chat.sendMessageStream({ message: userText });
            console.log(`[gemini] ${keyLabel} / selected model: ${modelId}`);
            const chunks = async function* () {
              try {
                for await (const chunk of stream) {
                  const text = chunk.text;
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
              console.warn(
                `[gemini] ${keyLabel} / ${modelId} skipped (${status ?? 429}), trying next model`,
              );
              continue;
            }
            console.error(`[gemini] ${keyLabel} / ${modelId} failed:`, normalized.message);
            throw normalized;
          }
        }

        console.warn(`[gemini] ${keyLabel} exhausted on all models, trying next key`);
      }

      console.error("[gemini] all keys × all models exhausted");
      throw new LlmQuotaError("All Gemini API keys have exhausted their quota", null);
    },
  };
}
