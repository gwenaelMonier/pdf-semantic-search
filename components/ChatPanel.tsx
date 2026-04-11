"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type CitationTarget = { page: number; quote?: string };

type Props = {
  sessionId: string;
  filename: string;
  pageCount: number;
  onPageClick: (target: CitationTarget) => void;
  onReset: () => void;
};

// Matches [p. 12: "extrait"] OR [p. 12, 34, 56]
const CITATION_REGEX =
  /\[p\.\s*(\d+)\s*:\s*"([^"]+)"\]|\[p\.\s*([\d,\s]+)\]/g;

function renderWithCitations(
  text: string,
  onPageClick: (target: CitationTarget) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  CITATION_REGEX.lastIndex = 0;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const targets: CitationTarget[] = match[2]
      ? [{ page: parseInt(match[1], 10), quote: match[2] }]
      : match[3]
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
          .map((page) => ({ page }));

    parts.push(
      <span key={`cite-${key++}`} className="inline-flex flex-wrap gap-1 align-baseline">
        {targets.map((t, i) => (
          <button
            key={i}
            onClick={() => onPageClick(t)}
            title={t.quote}
            className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 transition hover:bg-blue-200"
          >
            p. {t.page}
          </button>
        ))}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function ChatPanel({
  sessionId,
  filename,
  pageCount,
  onPageClick,
  onReset,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question,
          history: messages,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur de requête");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((curr) => {
          const copy = [...curr];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages((curr) => {
        const copy = [...curr];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Erreur : ${err instanceof Error ? err.message : "inconnue"}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">
            {filename}
          </h2>
          <p className="text-xs text-zinc-500">{pageCount} pages</p>
        </div>
        <button
          onClick={onReset}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Nouveau PDF
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-zinc-500">
            Posez une question sur la convention collective.
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.role === "assistant"
                  ? renderWithCitations(m.content || "…", onPageClick)
                  : m.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-zinc-200 p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Votre question…"
            disabled={streaming}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {streaming ? "…" : "Envoyer"}
          </button>
        </div>
      </form>
    </div>
  );
}
