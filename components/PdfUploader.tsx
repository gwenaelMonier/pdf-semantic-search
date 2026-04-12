"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/presets")
      .then((r) => r.json())
      .then((data: { presets?: string[] }) => {
        if (!cancelled && Array.isArray(data.presets)) {
          setPresets(data.presets);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handlePreset = useCallback(
    async (name: string) => {
      setError(null);
      setLoadingPreset(name);
      try {
        const res = await fetch(`/api/presets/${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error("Impossible de charger la convention.");
        const blob = await res.blob();
        const file = new File([blob], name, { type: "application/pdf" });
        await handleFile(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoadingPreset(null);
      }
    },
    [handleFile],
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

        {presets.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200" />
              ou choisir une convention existante
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <ul className="space-y-2">
              {presets.map((name) => {
                const busy = loadingPreset === name;
                const disabled = loading || loadingPreset !== null;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => handlePreset(name)}
                      disabled={disabled}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[10px] font-bold text-red-600"
                        >
                          PDF
                        </span>
                        <span className="truncate text-zinc-800">{name}</span>
                      </span>
                      {busy ? (
                        <span className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
                          Chargement…
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-blue-600">
                          Charger
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
