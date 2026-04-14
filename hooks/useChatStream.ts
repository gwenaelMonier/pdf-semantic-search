"use client";

import { useState } from "react";

export type Message = {
  role: "user" | "assistant";
  content: string;
  model?: string;
};

export type UseChatStreamResult = {
  messages: Message[];
  streaming: boolean;
  send: (question: string) => Promise<void>;
};

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

      const modelUsed = res.headers.get("X-Gemini-Model") ?? undefined;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((curr) => {
          const copy = [...curr];
          copy[copy.length - 1] = { role: "assistant", content: acc, model: modelUsed };
          return copy;
        });
      }
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

  return { messages, streaming, send };
}
