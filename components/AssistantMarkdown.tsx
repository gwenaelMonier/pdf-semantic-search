"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitByCitations } from "@/lib/citation-segments";
import type { CitationTarget } from "@/lib/citations";

type Props = {
  content: string;
  onPageClick: (target: CitationTarget) => void;
};

function renderSegments(text: string, onPageClick: (t: CitationTarget) => void): ReactNode[] {
  const segments = splitByCitations(text);
  const nodes: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (seg.type === "text") {
      nodes.push(seg.value);
      return;
    }
    const citeKey = `cite-${i}-${seg.targets.map((t) => `${t.page}:${t.quote ?? ""}`).join("|")}`;
    nodes.push(
      <span key={citeKey} className="inline-flex flex-wrap gap-1 align-baseline">
        {seg.targets.map((t) => (
          <button
            type="button"
            key={`${t.page}-${t.quote ?? ""}`}
            onClick={() => onPageClick(t)}
            title={t.quote}
            className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 transition hover:bg-blue-200"
          >
            p. {t.page}
          </button>
        ))}
      </span>,
    );
  });
  return nodes;
}

function processChildrenForCitations(
  children: ReactNode,
  onPageClick: (target: CitationTarget) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return renderSegments(child, onPageClick);
    }
    return child;
  });
}

export function AssistantMarkdown({ content, onPageClick }: Props) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{processChildrenForCitations(children, onPageClick)}</p>
          ),
          li: ({ children }) => (
            <li className="mb-1 last:mb-0">{processChildrenForCitations(children, onPageClick)}</li>
          ),
          ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-lg font-bold text-zinc-900 first:mt-0">
              {processChildrenForCitations(children, onPageClick)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 border-b border-zinc-300 pb-1 text-base font-bold text-zinc-900 first:mt-0">
              {processChildrenForCitations(children, onPageClick)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-3 text-sm font-bold uppercase tracking-wide text-zinc-700 first:mt-0">
              {processChildrenForCitations(children, onPageClick)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-2 text-sm font-semibold text-zinc-800 first:mt-0">
              {processChildrenForCitations(children, onPageClick)}
            </h4>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">
              {processChildrenForCitations(children, onPageClick)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">{processChildrenForCitations(children, onPageClick)}</em>
          ),
          code: ({ children }) => (
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs">{children}</code>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-300 bg-zinc-200 px-2 py-1 text-left font-semibold">
              {processChildrenForCitations(children, onPageClick)}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-300 px-2 py-1">
              {processChildrenForCitations(children, onPageClick)}
            </td>
          ),
        }}
      >
        {content || "…"}
      </ReactMarkdown>
    </div>
  );
}
