import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { streamAnswer, type ChatTurn } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

function formatStreamError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) {
    const match = e.message?.match(/retry in ([\d.]+)s/i);
    const delay = match ? Math.ceil(parseFloat(match[1])) : null;
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
    const body = (await req.json()) as {
      sessionId?: string;
      question?: string;
      history?: ChatTurn[];
    };

    if (!body.sessionId || !body.question) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

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
            history: body.history ?? [],
            question: body.question!,
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
