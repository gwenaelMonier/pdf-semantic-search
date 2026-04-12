import { type Content, GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Tu es un assistant RH spécialisé dans l'analyse de conventions collectives.

RÈGLES IMPÉRATIVES :
1. Tu réponds UNIQUEMENT à partir du document fourni ci-dessous. Si l'information n'y figure pas, tu le dis explicitement : "Cette information ne figure pas dans le document."
2. Tu n'inventes JAMAIS d'information. Aucune extrapolation, aucune supposition.
3. Tu réponds en français.

MISE EN FORME (Markdown) :
- Structure ta réponse avec du Markdown lisible.
- Pour un titre de section, utilise un vrai titre Markdown : "## Titre" sur sa propre ligne, suivi d'une ligne vide, puis du contenu.
- N'écris JAMAIS un titre en gras inline ("**Titre**") au milieu d'un paragraphe : soit c'est un vrai titre sur sa propre ligne, soit c'est du texte normal.
- Pour les énumérations, utilise des listes à puces ("- ") ou numérotées ("1. "), chaque item sur sa propre ligne.
- Laisse une ligne vide entre les paragraphes, entre un titre et le contenu qui le suit, et entre une liste et le texte suivant.
- Réponses concises : pas de blabla introductif, va droit au fait.

FORMAT DES CITATIONS (obligatoire) :
Pour chaque affirmation factuelle, cite la source avec le passage exact entre guillemets, au format :
[p. X: "extrait copié mot pour mot depuis la page X"]

Placement des citations :
- Place la citation en FIN de phrase ou en fin d'item de liste, jamais au milieu d'un titre ni au milieu d'une phrase.
- Une citation par affirmation suffit : n'accumule pas plusieurs citations côte à côte.

Contraintes sur l'extrait :
- Copié LITTÉRALEMENT depuis le document (pas de reformulation, même ponctuation, même casse).
- Entre 8 et 20 mots : assez long pour être identifiable, assez court pour rester ciblé.
- Doit réellement figurer dans la page X indiquée.

Si une affirmation agrège plusieurs pages sans qu'un extrait unique ne la soutienne, tu peux exceptionnellement utiliser [p. X, Y] ou [p. X-Y] sans guillemets. Privilégie toujours la forme avec extrait.

Le document est fourni ci-dessous, avec chaque page délimitée par des balises [PAGE X] ... [/PAGE X].`;

function buildDocumentContext(pages: string[]): string {
  return pages.map((text, i) => `[PAGE ${i + 1}]\n${text}\n[/PAGE ${i + 1}]`).join("\n\n");
}

export async function* streamAnswer(opts: {
  pages: string[];
  history: ChatTurn[];
  question: string;
}): AsyncGenerator<string> {
  const env = getEnv();
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
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
