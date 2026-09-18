"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

// AUSCIS Intake Intelligence Layer -- exception-resolution / readiness
// recheck surface (R-02, CR-CPS-37/38). A clean Intake already
// transitions to 'complete' automatically at submission
// (src/app/api/intake/route.ts) -- no staff click required (load-bearing
// R-02 requirement). This surface exists for the exception case: after
// resolving whatever the deterministic readiness reasons flagged, staff
// can re-run the exact same shared readiness function
// (src/lib/intake/readiness.ts) via /api/intake-intelligence/complete.

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

const REASON_LABEL: Record<string, string> = {
  missing_identity_information: "Faltan campos de identidad requeridos",
  coach_not_completed: "El beneficiario no completó la conversación con el Coach",
  unresolved_structured_profile_conflict: "Hay información en conflicto sin resolver en el Perfil Estructurado",
};

export function IntakeIntelligenceSection({ caseId, submissionId, status, structuredProfile, coachTurns }: IntakeIntelligenceSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [reasons, setReasons] = useState<string[] | null>(null);

  if (!submissionId) return null;

  const fields = Object.entries(structuredProfile ?? {}).filter(([, f]) => f.status !== "not_yet_acquired");
  const conflicting = fields.filter(([, f]) => f.status === "conflicting").length;
  const confirmed = fields.filter(([, f]) => f.status === "beneficiary_confirmed").length;

  async function recheckReadiness() {
    setLoading(true);
    setError(null);
    setReasons(null);
    try {
      const res = await fetch("/api/intake-intelligence/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al reevaluar el intake");
      } else if (json.status === "NEEDS_ATTENTION") {
        setReasons(json.reasons ?? []);
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

      {reasons && reasons.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-700">Requiere atención:</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
            {reasons.map(r => <li key={r}>{REASON_LABEL[r] ?? r}</li>)}
          </ul>
        </div>
      )}

      {currentStatus === "complete" ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 size={15}/> Intake completo. A1 puede procesar este caso normalmente.
        </p>
      ) : (
        <button type="button" onClick={recheckReadiness} disabled={loading}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {loading && <Loader2 size={13} className="animate-spin"/>}
          Reevaluar preparación (Automated Readiness)
        </button>
      )}
    </div>
  );
}
