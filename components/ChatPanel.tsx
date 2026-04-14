"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AssistantMarkdown } from "@/components/AssistantMarkdown";
import { useChatStream } from "@/hooks/useChatStream";
import type { CitationTarget } from "@/lib/citations";

export type { Message } from "@/hooks/useChatStream";
export type { CitationTarget };

type Props = {
  pages: string[];
  embeddings: number[][] | null;
  filename: string;
  pageCount: number;
  onPageClick: (target: CitationTarget) => void;
  onReset: () => void;
};

export function ChatPanel({ pages, embeddings, filename, pageCount, onPageClick, onReset }: Props) {
  const [ragEnabled, setRagEnabled] = useState(true);
  const { messages, streaming, send } = useChatStream(pages, embeddings, ragEnabled);
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

  const ragAvailable = embeddings !== null;
  const ragActive = ragAvailable && ragEnabled;
  const toggleDisabled = streaming || !ragAvailable;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">{filename}</h2>
          <p className="text-xs text-zinc-500">{pageCount} pages</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label
            className={`flex items-center gap-2 text-xs ${
              toggleDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
            title={
              !ragAvailable
                ? "Mode rapide indisponible (embeddings non calculés)"
                : "Ne consulte que les pages pertinentes. Plus rapide mais moins bon sur les questions globales."
            }
          >
            <span className="font-medium text-zinc-700">Mode rapide</span>
            <button
              type="button"
              role="switch"
              aria-checked={ragActive}
              disabled={toggleDisabled}
              onClick={() => setRagEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed ${
                ragActive ? "bg-blue-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  ragActive ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Nouveau PDF
          </button>
        </div>
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
              <div className="flex max-w-[90%] flex-col gap-1">
                {m.role === "assistant" && (
                  <p className="text-xs text-zinc-400">
                    🤖 Hr assistant{m.model ? ` (powered by ${m.model})` : ""}
                  </p>
                )}
                <div
                  className={`rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-blue-600 px-4 py-2.5 text-white"
                      : streaming && i === messages.length - 1 && m.content === ""
                        ? "w-fit bg-zinc-100 px-3 py-2.5 text-zinc-900"
                        : "bg-zinc-100 px-4 py-2.5 text-zinc-900"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <AssistantMarkdown
                      content={m.content}
                      onPageClick={onPageClick}
                      isLoading={streaming && i === messages.length - 1 && m.content === ""}
                    />
                  ) : (
                    m.content
                  )}
                </div>
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
