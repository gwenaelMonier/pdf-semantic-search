"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { ViewerTarget } from "@/app/page";
import { findHighlight, type PdfTextItem } from "@/lib/pdf-highlight";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  file: File;
  target: ViewerTarget;
  onPageChange: (page: number) => void;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function computeHighlightIndices(items: PdfTextItem[], quote: string, page: number): Set<number> {
  const res = findHighlight(items, quote);
  if (process.env.NODE_ENV !== "production" && !res.matched) {
    console.debug("[PdfViewer] highlight miss", { page, quote, strategy: res.strategy });
  }
  return res.indices;
}

export function PdfViewer({ file, target, onPageChange }: Props) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(600);
  const [fileData, setFileData] = useState<{ data: Uint8Array } | null>(null);
  const [highlightIndices, setHighlightIndices] = useState<Set<number>>(new Set());
  const textItemsRef = useRef<{ page: number; items: PdfTextItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    file.arrayBuffer().then((buf) => {
      if (!cancelled) setFileData({ data: new Uint8Array(buf) });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(Math.max(200, w - 32));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pdfOptions = useMemo(() => ({ wasmUrl: "/wasm/" }), []);

  const clampedPage = Math.min(Math.max(1, target.page), numPages || 1);

  // Recompute indices from the cached text items whenever the target
  // changes. If we haven't extracted this page's text yet, the cache is
  // empty and we wait for onGetTextSuccess to fill it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: target.nonce is an intentional re-trigger when the same citation is re-clicked
  useEffect(() => {
    const cached = textItemsRef.current;
    if (!target.quote || !cached || cached.page !== clampedPage) {
      setHighlightIndices(new Set());
      return;
    }
    setHighlightIndices(computeHighlightIndices(cached.items, target.quote, clampedPage));
  }, [target.nonce, target.page, target.quote, clampedPage]);

  const customTextRenderer = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      if (!highlightIndices.has(itemIndex)) return escapeHtml(str);
      return `<mark class="pdf-highlight">${escapeHtml(str)}</mark>`;
    },
    [highlightIndices],
  );

  const handleGetTextSuccess = useCallback(
    (textContent: { items: Array<{ str?: string } | object> }) => {
      const items: PdfTextItem[] = textContent.items.map((it) => ({
        str: "str" in it ? (it as { str?: string }).str : "",
      }));
      textItemsRef.current = { page: clampedPage, items };
      if (!target.quote) {
        setHighlightIndices(new Set());
        return;
      }
      setHighlightIndices(computeHighlightIndices(items, target.quote, clampedPage));
    },
    [target.quote, clampedPage],
  );

  useEffect(() => {
    if (highlightIndices.size === 0) return;
    const root = pageWrapperRef.current;
    if (!root) return;
    const deadline = Date.now() + 1000;
    const tryScroll = () => {
      const mark = root.querySelector("mark.pdf-highlight");
      if (mark) {
        mark.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      if (Date.now() < deadline) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
  }, [highlightIndices]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100">
      <style>{`
        .react-pdf__Page__textContent mark.pdf-highlight {
          background-color: rgba(253, 224, 71, 0.55);
          color: transparent;
          border-radius: 2px;
          padding: 0;
        }
      `}</style>
      <header className="flex h-14 shrink-0 items-center justify-center gap-3 border-b border-zinc-200 bg-white px-4">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
          disabled={clampedPage <= 1}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40"
        >
          ←
        </button>
        <span className="text-sm text-zinc-700">
          Page{" "}
          <input
            type="number"
            value={clampedPage}
            min={1}
            max={numPages || 1}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onPageChange(n);
            }}
            className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-sm"
          />{" "}
          / {numPages || "…"}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(numPages, clampedPage + 1))}
          disabled={clampedPage >= numPages}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40"
        >
          →
        </button>
      </header>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto p-4">
        <Document
          file={fileData}
          options={pdfOptions}
          onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
          loading={<p className="text-center text-sm text-zinc-500">Chargement…</p>}
          error={<p className="text-center text-sm text-red-500">Erreur de chargement.</p>}
        >
          {numPages > 0 && (
            <div ref={pageWrapperRef} className="flex justify-center">
              <Page
                pageNumber={clampedPage}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={true}
                customTextRenderer={customTextRenderer}
                onGetTextSuccess={handleGetTextSuccess}
                onRenderError={(err) => console.error("[PdfViewer] render error", err)}
                className="shadow-lg"
              />
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
