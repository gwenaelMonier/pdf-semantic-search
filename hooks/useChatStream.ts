"use client";

import { useState } from "react";

export type MessageMeta = {
  model?: string;
  promptTokens?: number;
  responseTokens?: number;
  pagesSent?: number;
  pagesTotal?: number;
  durationMs?: number;
  truncated?: boolean;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: MessageMeta;
};

export type UseChatStreamResult = {
  messages: Message[];
  streaming: boolean;
  send: (question: string) => Promise<void>;
  resendLast: () => Promise<void>;
};

function parseSentinel(acc: string): { content: string; meta: MessageMeta | undefined } {
  const idx = acc.indexOf("\x00");
  if (idx === -1) return { content: acc, meta: undefined };
  const content = acc.slice(0, idx);
  try {
    const meta = JSON.parse(acc.slice(idx + 1)) as MessageMeta;
    return { content, meta };
  } catch {
    return { content, meta: undefined };
  }
}

export function useChatStream(pages: string[], ragEnabled: boolean): UseChatStreamResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

  async function send(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    const history = messages;
    setMessages([
      ...history,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    const startedAt = Date.now();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, ragEnabled, question: trimmed, history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request error");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        // Strip sentinel during streaming so it doesn't flash in the UI
        const displayContent = acc.includes("\x00") ? acc.slice(0, acc.indexOf("\x00")) : acc;
        setMessages((curr) => {
          const copy = [...curr];
          copy[copy.length - 1] = { role: "assistant", content: displayContent };
          return copy;
        });
      }

      // Final update: parse sentinel and attach metadata
      const durationMs = Date.now() - startedAt;
      const { content, meta } = parseSentinel(acc);
      const truncated = meta === undefined && content.trim().length > 0;
      setMessages((curr) => {
        const copy = [...curr];
        copy[copy.length - 1] = {
          role: "assistant",
          content,
          meta: meta ? { ...meta, durationMs } : truncated ? { truncated: true } : undefined,
        };
        return copy;
      });
    } catch (err) {
      setMessages((curr) => {
        const copy = [...curr];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function resendLast(): Promise<void> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Drop the last assistant message (truncated) before resending
    setMessages((curr) => curr.slice(0, -1));
    await send(lastUser.content);
  }

  return { messages, streaming, send, resendLast };
}
