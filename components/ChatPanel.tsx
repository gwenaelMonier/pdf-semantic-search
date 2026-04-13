"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AssistantMarkdown } from "@/components/AssistantMarkdown";
import { useChatStream } from "@/hooks/useChatStream";
import type { CitationTarget } from "@/lib/citations";

export type { Message } from "@/hooks/useChatStream";
export type { CitationTarget };

type Props = {
  pages: string[];
  filename: string;
  pageCount: number;
  onPageClick: (target: CitationTarget) => void;
  onReset: () => void;
};

export function ChatPanel({ pages, filename, pageCount, onPageClick, onReset }: Props) {
  const { messages, streaming, send } = useChatStream(pages);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to re-scroll every time messages change, including during streaming
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    await send(question);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">{filename}</h2>
          <p className="text-xs text-zinc-500">{pageCount} pages</p>
        </div>
        <button
          type="button"
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
            // biome-ignore lint/suspicious/noArrayIndexKey: chat messages are append-only, index is stable
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.role === "assistant" ? (
                  <AssistantMarkdown content={m.content} onPageClick={onPageClick} />
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-zinc-200 p-4">
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
