"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChatPanel, type CitationTarget } from "@/components/ChatPanel";
import { PdfUploader, type UploadResult } from "@/components/PdfUploader";

const PdfViewer = dynamic(() => import("@/components/PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
});

export type ViewerTarget = CitationTarget & { nonce: number };

export default function Home() {
  const [session, setSession] = useState<UploadResult | null>(null);
  const [target, setTarget] = useState<ViewerTarget>({ page: 1, nonce: 0 });

  if (!session) {
    return <PdfUploader onUploaded={setSession} />;
  }

  return (
    <div className="grid h-screen grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <ChatPanel
        pages={session.pages}
        filename={session.filename}
        pageCount={session.pageCount}
        onPageClick={(t) => setTarget((prev) => ({ ...t, nonce: prev.nonce + 1 }))}
        onReset={() => {
          setSession(null);
          setTarget({ page: 1, nonce: 0 });
        }}
      />
      <PdfViewer
        file={session.file}
        target={target}
        onPageChange={(page) => setTarget((prev) => ({ page, nonce: prev.nonce + 1 }))}
      />
    </div>
  );
}
