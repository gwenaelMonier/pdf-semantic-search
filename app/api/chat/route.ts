import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamAnswer } from "@/lib/gemini";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_HISTORY_TURNS = 20;
const MAX_TURN_CHARS = 8_000;
const MAX_QUESTION_CHARS = 4_000;

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_TURN_CHARS),
});

const ChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  question: z.string().min(1).max(MAX_QUESTION_CHARS),
  history: z.array(ChatTurnSchema).max(MAX_HISTORY_TURNS).optional().default([]),
});

function formatStreamError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) {
    const match = e.message?.match(/retry in ([\d.]+)s/i);
    const delay = match ? Math.ceil(Number.parseFloat(match[1])) : null;
    const retry = delay ? ` Réessayez dans environ ${delay}s.` : "";
    return (
      "\n\n> ⚠️ **Quota Gemini épuisé** (palier gratuit).\n> " +
      "Le modèle `gemini-2.5-flash` est limité à 20 requêtes par jour sur ce compte." +
      retry +
      "\n> Vous pouvez passer à `gemini-2.5-flash-lite` via la variable d'environnement `GEMINI_MODEL`."
    );
  }
  return "\n\n[Erreur lors de la génération de la réponse.]";
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides.", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const session = getSession(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session introuvable. Rechargez le PDF." },
        { status: 404 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamAnswer({
            pages: session.pages,
            history: body.history,
            question: body.question,
          })) {
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
      },
    });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
