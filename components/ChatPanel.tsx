"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AssistantMarkdown } from "@/components/AssistantMarkdown";
import { useChatStream, type MessageMeta } from "@/hooks/useChatStream";
import type { CitationTarget } from "@/lib/citations";

export type { Message } from "@/hooks/useChatStream";
export type { CitationTarget };

function MessageFooter({ meta }: { meta: MessageMeta }) {
  const parts: string[] = [];
  if (meta.durationMs !== undefined) parts.push(`${(meta.durationMs / 1000).toFixed(1)}s`);
  if (meta.model) parts.push(meta.model);
  const totalTokens = (meta.promptTokens ?? 0) + (meta.responseTokens ?? 0);
  if (totalTokens > 0) parts.push(`${totalTokens.toLocaleString("fr-FR")} tokens`);
  if (meta.pagesSent !== undefined && meta.pagesTotal !== undefined && meta.pagesSent < meta.pagesTotal) {
    parts.push(`${meta.pagesSent}/${meta.pagesTotal} pages`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="mt-1.5 text-xs text-zinc-400">
      {parts.join(" · ")}
    </p>
  );
}

type Props = {
  pages: string[];
  filename: string;
  pageCount: number;
  onPageClick: (target: CitationTarget) => void;
  onReset: () => void;
};

export function ChatPanel({ pages, filename, pageCount, onPageClick, onReset }: Props) {
  const [ragEnabled, setRagEnabled] = useState(true);
  const { messages, streaming, send, resendLast } = useChatStream(pages, ragEnabled);
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
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">{filename}</h2>
          <p className="text-xs text-zinc-500">{pageCount} pages</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label
            className={`flex items-center gap-2 text-xs ${
              streaming ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-1 font-medium text-zinc-700">
              Économie de tokens
              <span className="group relative flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-600"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 w-56 -translate-x-1/2 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                  Sélectionne les pages pertinentes par mots-clés (BM25). Plus rapide mais moins bon sur les questions globales type « résume ce document ».
                </span>
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={ragEnabled}
              disabled={streaming}
              onClick={() => setRagEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed ${
                ragEnabled ? "bg-blue-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  ragEnabled ? "translate-x-4" : "translate-x-0.5"
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
            Posez une question sur le document.
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: chat messages are append-only, index is stable
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="flex max-w-[90%] flex-col">
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
                {m.role === "assistant" && m.meta && !(streaming && i === messages.length - 1) && (
                  m.meta.truncated ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-amber-500">⚠ Réponse interrompue</span>
                      <button
                        type="button"
                        onClick={resendLast}
                        disabled={streaming}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Réessayer
                      </button>
                    </div>
                  ) : (
                    <MessageFooter meta={m.meta} />
                  )
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
