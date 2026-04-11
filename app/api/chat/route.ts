import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { streamAnswer, type ChatTurn } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

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
          controller.enqueue(
            encoder.encode("\n\n[Erreur lors de la génération de la réponse.]"),
          );
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
