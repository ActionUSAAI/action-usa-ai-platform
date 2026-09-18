"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

// AUSCIS Intake Intelligence Layer -- Staff Review (CR-CPS-34/35,
// design §5.7/§5.8). Occurs after beneficiary review. Reuses the
// existing admin/supervisor-or-assigned-agent authorization pattern
// (src/app/api/case-letters/route.ts) via /api/intake-intelligence/complete.

export interface StructuredProfileFieldView {
  value: string | null;
  source: string | null;
  confidence: string | null;
  status: string;
}

interface IntakeIntelligenceSectionProps {
  caseId: string;
  submissionId: string | null;
  status: string | null;
  structuredProfile: Record<string, StructuredProfileFieldView> | null;
  coachTurns: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", submitted: "Enviado", processing: "Procesando", complete: "Completo",
};

export function IntakeIntelligenceSection({ caseId, submissionId, status, structuredProfile, coachTurns }: IntakeIntelligenceSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);

  if (!submissionId) return null;

  const fields = Object.entries(structuredProfile ?? {}).filter(([, f]) => f.status !== "not_yet_acquired");
  const conflicting = fields.filter(([, f]) => f.status === "conflicting").length;
  const confirmed = fields.filter(([, f]) => f.status === "beneficiary_confirmed").length;

  async function markComplete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intake-intelligence/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al completar el intake");
      } else {
        setCurrentStatus("complete");
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-blue">Intake Intelligence Layer (Stage 1)</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${currentStatus === "complete" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABEL[currentStatus ?? ""] ?? currentStatus ?? "—"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Campos adquiridos</dt>
          <dd className="font-medium text-gray-900">{fields.length}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Confirmados por beneficiario</dt>
          <dd className="font-medium text-gray-900">{confirmed}</dd>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare size={13} className="text-gray-400"/>
          <div>
            <dt className="text-gray-500">Turnos con Coach</dt>
            <dd className="font-medium text-gray-900">{coachTurns}</dd>
          </div>
        </div>
      </dl>

      {conflicting > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertCircle size={13}/> {conflicting} campo(s) con información en conflicto sin resolver.
        </p>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {currentStatus === "complete" ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 size={15}/> Intake marcado como completo. A1 puede procesar este caso normalmente.
        </p>
      ) : (
        <button type="button" onClick={markComplete} disabled={loading}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {loading && <Loader2 size={13} className="animate-spin"/>}
          Marcar Intake como completo
        </button>
      )}
    </div>
  );
}
