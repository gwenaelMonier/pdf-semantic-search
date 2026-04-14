import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildIndex, topKPages } from "@/lib/bm25";
import { getLlmClient } from "@/lib/llm";
import { LlmQuotaError, LlmTransientError, normalizeLlmError } from "@/lib/llm-errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_HISTORY_TURNS = 20;
const MAX_TURN_CHARS = 32_000;
const MAX_QUESTION_CHARS = 4_000;
const RAG_TOP_K = 5;

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_TURN_CHARS),
});

const ChatRequestSchema = z.object({
  pages: z.array(z.string()).min(1).max(500),
  ragEnabled: z.boolean().optional().default(false),
  question: z.string().min(1).max(MAX_QUESTION_CHARS),
  history: z.array(ChatTurnSchema).max(MAX_HISTORY_TURNS).optional().default([]),
});

function formatStreamError(err: unknown): string {
  const e = normalizeLlmError(err);
  if (e instanceof LlmQuotaError) {
    const retry = e.retryAfterSeconds ? ` Réessayez dans environ ${e.retryAfterSeconds}s.` : "";
    return (
      "\n\n> ⚠️ **Quota Gemini épuisé** (palier gratuit).\n> " +
      "Tous les modèles disponibles ont atteint leur limite quotidienne." +
      retry
    );
  }
  if (e instanceof LlmTransientError) {
    return "\n\n[Erreur transitoire côté Gemini. Réessayez dans quelques instants.]";
  }
  return "\n\n[Erreur lors de la génération de la réponse.]";
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("zod issues", parsed.error.issues);
      return NextResponse.json(
        { error: "Paramètres invalides.", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;

    let contextPages: { index: number; text: string }[];
    if (body.ragEnabled) {
      const index = buildIndex(body.pages);
      const topIndices = topKPages(index, body.question, RAG_TOP_K);
      if (topIndices.length === 0) {
        contextPages = body.pages.map((text, i) => ({ index: i, text }));
        console.log(`[chat] recherche ciblée : aucun match BM25, fallback mode complet`);
      } else {
        contextPages = topIndices.map((i) => ({ index: i, text: body.pages[i] }));
        console.log(
          `[chat] recherche ciblée : ${contextPages.length}/${body.pages.length} pages (p. ${topIndices.map((i) => i + 1).join(", ")})`,
        );
      }
    } else {
      contextPages = body.pages.map((text, index) => ({ index, text }));
      console.log(`[chat] mode complet : ${contextPages.length} pages envoyées`);
    }

    const llm = getLlmClient();
    const encoder = new TextEncoder();

    let streamResult: Awaited<ReturnType<typeof llm.streamAnswer>>;
    try {
      streamResult = await llm.streamAnswer({
        pages: contextPages,
        history: body.history,
        question: body.question,
      });
    } catch (err) {
      console.error("stream error", err);
      const errorMsg = formatStreamError(err);
      const errStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        },
      });
      return new Response(errStream, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    const { model, chunks } = streamResult;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error("stream error", err);
          controller.enqueue(encoder.encode(formatStreamError(err)));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Gemini-Model": model,
      },
    });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
