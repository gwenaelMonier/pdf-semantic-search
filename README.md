# HR Assistant

AI-powered chatbot that answers HR questions about a **collective agreement** (convention collective) you upload as a PDF. For every answer, the model cites the source pages and clicking a citation jumps to the page and **highlights the exact quoted passage** in the PDF viewer.

## Features

- PDF upload via drag & drop (30 MB / 500 pages max)
- Conversational chat with streaming responses and session history
- Sourced citations in the format `[p. X: "verbatim excerpt"]`
- Click a citation → jump to the page, highlight the passage, auto-scroll to it
- Split view: chat on the left, PDF viewer on the right
- Zero hallucination: the model explicitly says when the info is not in the document

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Google Gemini 2.5 Flash** via `@google/generative-ai`
- **unpdf** for server-side PDF text extraction
- **react-pdf** / **pdf.js** for client-side rendering and highlighting

No vector store, no RAG: the full document is sent to the model on every request. Gemini's 1M token context window is more than enough for a typical collective agreement.

## Prerequisites

- **Node.js 20+**
- A (free) Gemini API key: https://aistudio.google.com/apikey

## Installation

```bash
npm install
cp .env.local.example .env.local
# then edit .env.local and paste your key:
# GEMINI_API_KEYS=your_key_here
# (ou `key1,key2` pour rotation multi-clés en free tier)
```

## Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), drop a collective agreement PDF, and start asking questions.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEYS` | yes | Google AI Studio API key (liste séparée par virgules pour rotation automatique en cas de quota épuisé) |
| `GEMINI_MODEL` | no | Gemini model to use (default: `gemini-2.5-flash`) |

## Project structure

```
app/
  api/
    upload/route.ts     # POST PDF → extract text → create session
    chat/route.ts       # POST question → stream Gemini response
  page.tsx              # orchestration: uploader / chat / viewer
  layout.tsx
components/
  PdfUploader.tsx       # drag & drop uploader
  ChatPanel.tsx         # chat UI + citation parsing
  PdfViewer.tsx         # react-pdf + n-gram highlighting
lib/
  pdf.ts                # per-page text extraction (unpdf)
  gemini.ts             # Gemini client + system prompt
  session.ts            # in-memory session store (2h TTL)
```

## Known limitations

- No persistence: history and PDF are lost on refresh.
- Sessions live in server memory → not suitable for multi-instance deployment as-is.
- Highlighting uses fuzzy trigram matching: may miss the mark if the model's excerpt diverges too much from the raw PDF text.
- Single user, no authentication.
