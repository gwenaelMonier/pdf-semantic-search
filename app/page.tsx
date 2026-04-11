"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { PdfUploader, type UploadResult } from "@/components/PdfUploader";

const PdfViewer = dynamic(
  () => import("@/components/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false },
);

export default function Home() {
  const [session, setSession] = useState<UploadResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  if (!session) {
    return <PdfUploader onUploaded={setSession} />;
  }

  return (
    <div className="grid h-screen grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <ChatPanel
        sessionId={session.sessionId}
        filename={session.filename}
        pageCount={session.pageCount}
        onPageClick={(p) => setCurrentPage(p)}
        onReset={() => setSession(null)}
      />
      <PdfViewer
        file={session.file}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
