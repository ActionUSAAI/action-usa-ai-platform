"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

// QA Engine — bounded MVP UI (docs/QA_ENGINE_FINAL_EXACT_DESIGN.md,
// SHA256 33d5f7f07cebfd1acc261e66ea1d10e4f2298671b3c0271a8f0ef8ab678510ab).
// Deterministic advisory checking only — never implies USCIS approval,
// legal conclusion, or Evidence verification. No "fix"/"regenerate"
// actions: QA signals, existing governed processes act.

interface QaFindings {
  blueprint_snapshot: { case_strategy_id: string; dominant_criteria: string[]; supporting_criteria: string[] } | null;
  evaluated_letters: { id: string; criterion_covered: string }[];
  evaluated_petition_drafts: { id: string; criteria_covered: string[] }[];
  missing_criteria: string[];
  current_blueprint_found: boolean;
}

interface QaRun {
  id: string;
  executed_at: string;
  findings: QaFindings;
}

const ALLOWED_ROLES = new Set(["admin", "supervisor", "agent"]);

export function QaPanel({ caseId, userRole }: { caseId: string; userRole: string }) {
  const [runs, setRuns] = useState<QaRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/qa-runs`);
      const data = await res.json();
      if (res.ok) setRuns(data.runs ?? []);
    } catch {
      // history load failure is non-fatal for this bounded panel
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/qa-runs`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al ejecutar la verificación de QA");
      } else {
        await loadHistory();
      }
    } catch {
      setError("Error de red al ejecutar la verificación de QA");
    } finally {
      setRunning(false);
    }
  }

  if (!ALLOWED_ROLES.has(userRole)) return null;

  const latest = runs[0];

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#1B2B5E]" /> Verificación de QA
        </h3>
        <button
          onClick={handleRun}
          disabled={running}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1B2B5E] text-white disabled:opacity-50 flex items-center gap-1"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : null}
          {running ? "Ejecutando..." : "Ejecutar QA"}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Verificación determinística de cobertura de criterios y vigencia del Blueprint. No sustituye revisión legal ni verificación de evidencia.
      </p>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {loadingHistory ? (
        <p className="text-xs text-gray-400">Cargando historial...</p>
      ) : !latest ? (
        <p className="text-xs text-gray-400">Sin ejecuciones registradas.</p>
      ) : (
        <div className="text-xs space-y-2">
          <p className="text-gray-500">Última ejecución: {new Date(latest.executed_at).toLocaleString()}</p>
          {!latest.findings.current_blueprint_found ? (
            <p className="flex items-center gap-1.5 text-amber-700">
              <AlertTriangle size={13} /> No hay un Blueprint vigente para este caso — la estrategia o su evaluación de criterios base están desactualizadas.
            </p>
          ) : latest.findings.missing_criteria.length === 0 ? (
            <p className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 size={13} /> Cobertura documental completa para los criterios del Blueprint vigente.
            </p>
          ) : (
            <div className="text-amber-700">
              <p className="flex items-center gap-1.5">
                <AlertTriangle size={13} /> Criterios sin cobertura documental:
              </p>
              <ul className="list-disc list-inside ml-1 mt-1">
                {latest.findings.missing_criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {runs.length > 1 && (
        <p className="text-[11px] text-gray-400 mt-3">{runs.length} ejecuciones en el historial de este caso.</p>
      )}
    </div>
  );
}
