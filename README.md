# PDF Semantic Search

**[Live demo →](https://pdf-semantic-search-theta.vercel.app/)**

AI-powered chatbot that answers questions about any **PDF you upload**. For every answer, the model cites the source pages and clicking a citation jumps to the page and **highlights the exact quoted passage** in the PDF viewer.

## Features

- PDF upload via drag & drop (30 MB / 500 pages max), or pick from pre-loaded presets
- Conversational chat with streaming responses and in-page conversation history
- Sourced citations in the format `[p. X: "verbatim excerpt"]` — including multi-page `[p. 8: "q1", p. 9: "q2"]`
- Click a citation → jump to the page, highlight the passage, auto-scroll to it
- Split view: chat on the left, PDF viewer on the right
- Token-saving mode: BM25 keyword search selects only relevant pages before sending to the model
- Response metadata footer: response time, model used, token count, pages sent
- Automatic model & key rotation on quota exhaustion; retry button on stream interruption
- Zero hallucination: the model explicitly says when the info is not in the document

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Google Gemini 2.5 Flash** via `@google/genai`
- **unpdf** for server-side PDF text extraction
- **react-pdf** / **pdf.js** for client-side rendering and highlighting

## Prerequisites

- **Node.js 24+**
- A (free) Gemini API key: https://aistudio.google.com/apikey

## Installation

```bash
npm install
cp .env.local.example .env.local
# then edit .env.local and paste your key:
# GEMINI_API_KEYS=your_key_here
# (comma-separated for multi-key rotation on free tier: key1,key2)
```

## Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), drop a PDF, and start asking questions.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEYS` | yes | Google AI Studio API key (comma-separated list for automatic rotation on quota exhaustion) |
| `GEMINI_MODEL` | no | Gemini model to use (default: `gemini-2.5-flash`) |
