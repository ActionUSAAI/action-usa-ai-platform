"use client";

import { useState } from "react";
import { FileText, Download, Languages, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { downloadFile } from "@/lib/download-file";
import type { DocumentFile } from "./extract-files";
import type { RegistrationCompleteness } from "@/lib/documents/reconcile-intake-documents";

export interface DocTranslationLite {
  original_file_path: string;
  status: "processing" | "completed" | "failed";
  translation_docx_path: string | null;
  translation_docx_name: string | null;
}

interface DocumentsPanelProps {
  documentFiles: DocumentFile[];
  translations: DocTranslationLite[];
  caseId: string;
  userRole: string;
  registrationCompleteness: RegistrationCompleteness;
}

const RECONCILE_ALLOWED_ROLES = new Set(["admin", "supervisor", "agent"]);

export function DocumentsPanel({ documentFiles, translations, caseId, userRole, registrationCompleteness }: DocumentsPanelProps) {
  const [completeness, setCompleteness] = useState(registrationCompleteness);
  const [reconciling, setReconciling]   = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  async function handleReconcile() {
    setReconciling(true);
    setReconcileMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/reconcile-documents`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al reconciliar documentos");
      setReconcileMsg(
        `Recuperados: ${json.recovered}. Ya registrados: ${json.already_registered}. ` +
        `Sin archivo físico: ${json.missing_storage}. Fallidos: ${json.failed}.`
      );
      setCompleteness((prev) => ({
        ...prev,
        status: json.missing_storage > 0 || json.failed > 0 ? "incomplete" : "complete",
        registered: prev.registered + json.recovered,
        missing: prev.missing - json.recovered,
      }));
    } catch (err) {
      setReconcileMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setReconciling(false);
    }
  }

  function translationFor(filePath: string) {
    return translations.find((t) => t.original_file_path === filePath);
  }

  function statusBadge(doc: DocumentFile) {
    if (doc.isExcluded) return { variant: "gray" as const, label: "Excluido de traducción" };
    const t = translationFor(doc.filePath);
    if (!t) return { variant: "gray" as const, label: "Pendiente de traducción" };
    if (t.status === "completed") {
      // completed no siempre significa que se generó un .docx — A2 marca
      // completed también cuando determina que el documento ya está en
      // inglés y no requiere traducción (translation_docx_path queda null
      // en ese caso). Distinguir ambos evita el mensaje engañoso "Traducido"
      // en documentos que nunca se tradujeron porque no lo necesitaban.
      return t.translation_docx_path
        ? { variant: "success" as const, label: "Traducido" }
        : { variant: "gray" as const, label: "Ya en inglés" };
    }
    if (t.status === "processing") return { variant: "info" as const, label: "Traduciendo..." };
    return { variant: "danger" as const, label: "Error de traducción" };
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FileText size={16} />
        Documentos
        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
          {documentFiles?.length ?? 0}
        </span>
      </h3>

      {completeness.status === "incomplete" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle size={14} />
            Registro canónico incompleto — {completeness.missing} de {completeness.expected} documentos sin registrar.
          </div>
          {RECONCILE_ALLOWED_ROLES.has(userRole) && (
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <RefreshCw size={12} className={reconciling ? "animate-spin" : ""} />
              {reconciling ? "Reconciliando..." : "Reconciliar"}
            </button>
          )}
        </div>
      )}
      {reconcileMsg && (
        <p className="mb-4 text-xs text-gray-600">{reconcileMsg}</p>
      )}

      {!documentFiles || documentFiles.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No hay documentos cargados.</p>
      ) : (
        <div className="space-y-2">
          {documentFiles.map((doc) => {
            const badge = statusBadge(doc);
            const t = translationFor(doc.filePath);
            return (
              <div key={doc.filePath} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                  <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <button
                    onClick={() => downloadFile(doc.filePath, doc.fileName)}
                    className="text-gray-400 hover:text-[#1B2B5E]"
                    title="Descargar original"
                  >
                    <Download size={14} />
                  </button>
                  {t?.status === "completed" && t.translation_docx_path && (
                    <button
                      onClick={() => downloadFile(t.translation_docx_path!, t.translation_docx_name ?? undefined)}
                      className="text-gray-400 hover:text-[#1B2B5E]"
                      title="Descargar traducción (.docx)"
                    >
                      <Languages size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
