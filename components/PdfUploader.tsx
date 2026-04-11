"use client";

import { useCallback, useRef, useState } from "react";

export type UploadResult = {
  sessionId: string;
  filename: string;
  pageCount: number;
  file: File;
};

type Props = {
  onUploaded: (result: UploadResult) => void;
};

export function PdfUploader({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.type !== "application/pdf") {
        setError("Le fichier doit être un PDF.");
        return;
      }
      setLoading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur upload");
        onUploaded({
          sessionId: data.sessionId,
          filename: data.filename,
          pageCount: data.pageCount,
          file,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    },
    [onUploaded],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-center text-3xl font-semibold text-zinc-900">
          HR Assistant
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          Importez une convention collective et posez vos questions.
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-zinc-300 bg-white hover:border-zinc-400"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {loading ? (
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
              <p className="text-sm text-zinc-600">
                Extraction du texte en cours…
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-1 text-base font-medium text-zinc-800">
                Glissez-déposez un PDF ici
              </p>
              <p className="text-sm text-zinc-500">ou cliquez pour sélectionner</p>
              <p className="mt-4 text-xs text-zinc-400">
                PDF uniquement · 30 Mo max · 500 pages max
              </p>
            </div>
          )}
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
