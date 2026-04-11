"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { ViewerTarget } from "@/app/page";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File;
  target: ViewerTarget;
  onPageChange: (page: number) => void;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTrigrams(quote: string): string[] {
  const norm = normalize(quote);
  if (!norm) return [];
  const words = norm.split(" ");
  if (words.length < 3) return [norm];
  const trigrams: string[] = [];
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.push(words.slice(i, i + 3).join(" "));
  }
  return trigrams;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function PdfViewer({ file, target, onPageChange }: Props) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(600);
  const [fileData, setFileData] = useState<{ data: Uint8Array } | null>(null);

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

  const clampedPage = Math.min(Math.max(1, target.page), numPages || 1);

  const trigrams = target.quote ? buildTrigrams(target.quote) : [];

  const customTextRenderer = useCallback(
    ({ str }: { str: string; itemIndex: number }) => {
      if (trigrams.length === 0 || !str.trim()) return escapeHtml(str);
      const normItem = normalize(str);
      if (!normItem) return escapeHtml(str);
      const hit = trigrams.some(
        (t) => normItem.includes(t) || t.includes(normItem),
      );
      return hit
        ? `<mark class="hr-highlight">${escapeHtml(str)}</mark>`
        : escapeHtml(str);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigrams.join("|"), target.nonce],
  );

  useEffect(() => {
    if (!target.quote) return;
    const root = pageWrapperRef.current;
    if (!root) return;
    const deadline = Date.now() + 2000;
    const tryScroll = () => {
      const mark = root.querySelector("mark.hr-highlight");
      if (mark) {
        mark.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      if (Date.now() < deadline) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
  }, [target.nonce, target.page, target.quote]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100">
      <style>{`
        .react-pdf__Page__textContent mark.hr-highlight {
          background-color: rgba(253, 224, 71, 0.55);
          color: transparent;
          border-radius: 2px;
          padding: 0;
        }
      `}</style>
      <header className="flex h-14 shrink-0 items-center justify-center gap-3 border-b border-zinc-200 bg-white px-4">
        <button
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
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) onPageChange(n);
            }}
            className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-sm"
          />{" "}
          / {numPages || "…"}
        </span>
        <button
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
                className="shadow-lg"
              />
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
