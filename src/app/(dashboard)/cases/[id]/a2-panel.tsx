"use client";

import { useState } from "react";
import {
  FileText, Loader2, Download, CheckCircle, XCircle,
  Languages, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import type { DocumentFile } from "./extract-files";

export interface DocTranslation {
  id: string;
  case_id: string;
  status: "processing" | "completed" | "failed";
  original_file_path: string;
  original_file_name: string;
  document_type: string | null;
  document_category: string | null;
  document_title: string | null;
  detected_language: string | null;
  translation_docx_path: string | null;
  translation_docx_name: string | null;
  error_message: string | null;
  created_at: string;
}

interface A2PanelProps {
  caseId: string;
  documentFiles: DocumentFile[];
  initialTranslations: DocTranslation[];
  userRole: string;
}

const ALLOWED_ROLES = new Set(["admin", "supervisor", "agent"]);

export function A2Panel({ caseId, documentFiles, initialTranslations, userRole }: A2PanelProps) {
  const [translationMap, setTranslationMap] = useState<Map<string, DocTranslation>>(
    () => new Map(initialTranslations.map((t) => [t.original_file_path, t]))
  );
  const [translating, setTranslating]     = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors]       = useState<Map<string, string>>(new Map());
  const [showExcluded, setShowExcluded]   = useState(false);

  if (!ALLOWED_ROLES.has(userRole)) return null;

  const translatableFiles = documentFiles.filter((f) => !f.isExcluded);
  const excludedFiles     = documentFiles.filter((f) => f.isExcluded);

  const completedCount = translatableFiles.filter(
    (f) => translationMap.get(f.filePath)?.status === "completed"
  ).length;

  const pendingFiles = translatableFiles.filter((f) => {
    const t = translationMap.get(f.filePath);
    return !t || t.status === "failed";
  });

  async function handleTranslate(file: DocumentFile) {
    setTranslating((prev) => new Set(prev).add(file.filePath));
    setFileErrors((prev) => { const m = new Map(prev); m.delete(file.filePath); return m; });

    try {
      const res = await fetch("/api/agents/a2-document-processor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id:   caseId,
          file_path: file.filePath,
          file_name: file.fileName,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranslationMap((prev) => {
        const m = new Map(prev);
        m.set(file.filePath, data.translation);
        return m;
      });
    } catch (e) {
      setFileErrors((prev) => {
        const m = new Map(prev);
        m.set(file.filePath, e instanceof Error ? e.message : String(e));
        return m;
      });
    } finally {
      setTranslating((prev) => { const s = new Set(prev); s.delete(file.filePath); return s; });
    }
  }

  async function handleTranslateAll() {
    for (const file of pendingFiles) {
      await handleTranslate(file);
    }
  }

  async function handleDownload(docxPath: string, docxName: string) {
    try {
      const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(docxPath)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (e) {
      alert(`Error al generar enlace: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Languages size={18} className="text-[#1B2B5E]" />
          <h3 className="font-semibold text-gray-900">A2 — Traductor de Documentos</h3>
        </div>
        {pendingFiles.length > 0 && (
          <button
            type="button"
            onClick={handleTranslateAll}
            disabled={translating.size > 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#1B2B5E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#142147] disabled:opacity-60 transition-colors"
          >
            {translating.size > 0 ? (
              <><Loader2 size={12} className="animate-spin" /> Traduciendo...</>
            ) : (
              <><Languages size={12} /> Traducir todos ({pendingFiles.length})</>
            )}
          </button>
        )}
      </div>

      {/* Stats row */}
      {translatableFiles.length > 0 && (
        <div className="mb-4 flex items-center gap-3 text-xs text-gray-500">
          <span>{translatableFiles.length} documentos</span>
          <span className="text-gray-300">·</span>
          <span className="text-green-600 font-medium">{completedCount} traducidos</span>
          {pendingFiles.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-amber-600 font-medium">{pendingFiles.length} pendientes</span>
            </>
          )}
        </div>
      )}

      {/* File list */}
      {translatableFiles.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-8 text-center">
          <FileText size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No hay documentos para traducir en este caso.</p>
          <p className="text-xs text-gray-400 mt-1">
            Los documentos aparecerán aquí cuando el cliente complete el formulario de admisión.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {translatableFiles.map((file) => {
            const translation  = translationMap.get(file.filePath);
            const isTranslating = translating.has(file.filePath);
            const fileError    = fileErrors.get(file.filePath);

            return (
              <div
                key={file.filePath}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <FileText size={14} className="shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.label}</p>
                  <p className="text-xs text-gray-400 truncate">{file.fileName}</p>
                  {translation?.detected_language && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {translation.detected_language}
                      {translation.document_title && ` · ${translation.document_title}`}
                    </p>
                  )}
                  {fileError && (
                    <p className="text-xs text-red-600 mt-0.5 truncate" title={fileError}>
                      {fileError}
                    </p>
                  )}
                </div>

                {/* Action area */}
                <div className="flex items-center gap-2 shrink-0">
                  {isTranslating ? (
                    <span className="flex items-center gap-1 text-xs text-[#1B2B5E]">
                      <Loader2 size={12} className="animate-spin" /> Traduciendo...
                    </span>
                  ) : translation?.status === "completed" ? (
                    <>
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle size={12} /> Traducido
                      </span>
                      {translation.translation_docx_path && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDownload(
                              translation.translation_docx_path!,
                              translation.translation_docx_name ?? "translation.docx"
                            )
                          }
                          className="flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors"
                        >
                          <Download size={10} /> .docx
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTranslate(file)}
                        title="Re-traducir"
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </>
                  ) : translation?.status === "failed" ? (
                    <>
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <XCircle size={12} /> Error
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTranslate(file)}
                        className="rounded-md bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-100 transition-colors"
                      >
                        Reintentar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTranslate(file)}
                      disabled={isTranslating}
                      className="rounded-md bg-[#1B2B5E]/5 border border-[#1B2B5E]/20 px-2.5 py-1 text-xs font-medium text-[#1B2B5E] hover:bg-[#1B2B5E]/10 disabled:opacity-60 transition-colors"
                    >
                      Traducir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Excluded files (passports / visas) */}
      {excludedFiles.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showExcluded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {excludedFiles.length} documento{excludedFiles.length !== 1 ? "s" : ""} excluido
            {excludedFiles.length !== 1 ? "s" : ""} (pasaportes y visas)
          </button>
          {showExcluded && (
            <div className="mt-2 space-y-1">
              {excludedFiles.map((f) => (
                <div
                  key={f.filePath}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 opacity-50"
                >
                  <FileText size={12} className="text-gray-300 shrink-0" />
                  <p className="text-xs text-gray-500 truncate flex-1">{f.label}</p>
                  <span className="text-xs text-gray-400">Excluido</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
