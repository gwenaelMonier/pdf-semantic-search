"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File;
  currentPage: number;
  onPageChange: (page: number) => void;
};

export function PdfViewer({ file, currentPage, onPageChange }: Props) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const clampedPage = Math.min(Math.max(1, currentPage), numPages || 1);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100">
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
            <div className="flex justify-center">
              <Page
                pageNumber={clampedPage}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="shadow-lg"
              />
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
