import { GoogleGenerativeAI, type Content } from "@google/generative-ai";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Tu es un assistant RH spécialisé dans l'analyse de conventions collectives.

RÈGLES IMPÉRATIVES :
1. Tu réponds UNIQUEMENT à partir du document fourni ci-dessous. Si l'information n'y figure pas, tu le dis explicitement : "Cette information ne figure pas dans le document."
2. Tu n'inventes JAMAIS d'information. Aucune extrapolation, aucune supposition.
3. Pour chaque affirmation factuelle, tu cites la ou les pages sources au format EXACT [p. X] (ou [p. X, Y, Z] pour plusieurs pages).
4. Tu réponds en français, de manière concise et structurée.
5. Tu peux citer plusieurs pages si plusieurs passages sont pertinents.

Le document est fourni ci-dessous, avec chaque page délimitée par des balises [PAGE X] ... [/PAGE X].`;

function buildDocumentContext(pages: string[]): string {
  return pages
    .map((text, i) => `[PAGE ${i + 1}]\n${text}\n[/PAGE ${i + 1}]`)
    .join("\n\n");
}

export async function* streamAnswer(opts: {
  pages: string[];
  history: ChatTurn[];
  question: string;
}): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante dans .env.local");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
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
}
