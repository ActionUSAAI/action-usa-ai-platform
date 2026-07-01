"use client";

import { useState } from "react";
import { Brain, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";

export interface IntakeAnalysis {
  id: string;
  case_id: string;
  status: string;
  recommended_visa_type: string | null;
  visa_confidence: string | null;
  overall_strength: string | null;
  criteria_scores: Record<string, number> | null;
  criteria_met: Record<string, boolean> | null;
  criteria_gaps: Record<string, string | null> | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  strategy_notes: string | null;
  recommended_actions: string[] | null;
  created_at: string;
}

interface A1PanelProps {
  caseId: string;
  submissionId: string | null;
  initialAnalysis: IntakeAnalysis | null;
  userRole: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  awards:                "Premios y reconocimientos",
  memberships:           "Membresías en asociaciones",
  media_coverage:        "Cobertura mediática",
  judging:               "Rol de juez o evaluador",
  original_contributions:"Contribuciones originales al campo",
  scholarly_articles:    "Artículos académicos",
  critical_role:         "Rol crítico en organización distinguida",
  high_salary:           "Alta remuneración",
};

const VISA_BADGE: Record<string, string> = {
  "O-1A":      "bg-blue-100 text-blue-800",
  "O-1B":      "bg-purple-100 text-purple-800",
  "EB-1A":     "bg-emerald-100 text-emerald-800",
  "O-1A/EB-1A":"bg-indigo-100 text-indigo-800",
  unclear:     "bg-gray-100 text-gray-600",
};

const STRENGTH_BADGE: Record<string, string> = {
  strong:   "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-800",
  weak:     "bg-red-100 text-red-800",
};

const STRENGTH_LABEL: Record<string, string> = {
  strong:   "Perfil Sólido",
  moderate: "Perfil Moderado",
  weak:     "Perfil Débil",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   "Alta",
  medium: "Media",
  low:    "Baja",
};

function scoreBarColor(score: number): string {
  if (score >= 60) return "bg-green-500";
  if (score >= 25) return "bg-amber-400";
  return "bg-red-400";
}

function scorePillClass(score: number): string {
  if (score >= 60) return "bg-green-100 text-green-700";
  if (score >= 25) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function scoreViabilityLabel(score: number): string {
  if (score >= 75) return "VIABLE";
  if (score >= 50) return "DESARROLLABLE";
  if (score >= 25) return "DÉBIL";
  return "AUSENTE";
}

export function A1Panel({ caseId, submissionId, initialAnalysis, userRole }: A1PanelProps) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<IntakeAnalysis | null>(initialAnalysis);

  const canTrigger = ["admin", "supervisor", "agent"].includes(userRole);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/a1-intake-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, submission_id: submissionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al ejecutar el análisis A1");
      } else {
        setAnalysis(data.analysis as IntakeAnalysis);
      }
    } catch {
      setError("Error de red al conectar con el agente A1");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Brain size={18} className="text-[#1B2B5E]" />
          Análisis A1 — Intake Analyzer
        </h3>

        {canTrigger && !loading && (
          analysis ? (
            <button
              onClick={runAnalysis}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} /> Re-analizar
            </button>
          ) : (
            <button
              onClick={runAnalysis}
              disabled={!submissionId}
              className="flex items-center gap-1.5 rounded-lg bg-[#1B2B5E] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1B2B5E]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Analizar con A1 <ChevronRight size={14} />
            </button>
          )
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B2B5E]/20 border-t-[#1B2B5E]" />
          <p className="text-sm text-gray-600 font-medium">Analizando perfil del cliente...</p>
          <p className="text-xs text-gray-400">Esto puede tomar 20–40 segundos</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-100 p-4 mt-2">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error en el análisis</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* No intake submitted */}
      {!loading && !analysis && !submissionId && (
        <p className="text-sm text-gray-500 text-center py-8">
          El cliente no ha enviado su intake todavía. El análisis estará disponible una vez que complete el formulario.
        </p>
      )}

      {/* Intake submitted but no analysis yet */}
      {!loading && !analysis && submissionId && !error && (
        <p className="text-sm text-gray-500 text-center py-8">
          El intake está completo. Presiona <span className="font-medium text-gray-700">Analizar con A1</span> para evaluar los criterios de elegibilidad del cliente.
        </p>
      )}

      {/* Results */}
      {!loading && analysis && (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="flex flex-wrap items-end gap-4">
            {analysis.recommended_visa_type && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Visa recomendada</p>
                <span className={`inline-flex items-center rounded-full px-4 py-1 text-sm font-bold ${VISA_BADGE[analysis.recommended_visa_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {analysis.recommended_visa_type}
                </span>
              </div>
            )}
            {analysis.overall_strength && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Fortaleza del caso</p>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STRENGTH_BADGE[analysis.overall_strength] ?? "bg-gray-100 text-gray-600"}`}>
                  {STRENGTH_LABEL[analysis.overall_strength] ?? analysis.overall_strength}
                </span>
              </div>
            )}
            {analysis.visa_confidence && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Confianza</p>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  {CONFIDENCE_LABEL[analysis.visa_confidence] ?? analysis.visa_confidence}
                </span>
              </div>
            )}
            <div className="ml-auto text-xs text-gray-400">
              {new Date(analysis.created_at).toLocaleDateString("es-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Criteria bars */}
          {analysis.criteria_scores && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Criterios O-1A / EB-1A</h4>
              <div className="space-y-4">
                {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
                  const score = analysis.criteria_scores?.[key] ?? 0;
                  const met   = analysis.criteria_met?.[key] ?? false;
                  const gap   = analysis.criteria_gaps?.[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 text-sm">{met ? "✅" : "⬜"}</span>
                          <span className={`text-sm truncate ${met ? "font-medium text-gray-900" : "text-gray-500"}`}>
                            {label}
                          </span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${scorePillClass(score)}`}>
                            {scoreViabilityLabel(score)}
                          </span>
                        </div>
                        <span className="shrink-0 ml-3 text-sm font-mono font-semibold text-gray-600">
                          {score}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${scoreBarColor(score)}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      {gap && (
                        <p className="mt-1 text-xs text-gray-500 italic leading-snug">{gap}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Strengths & Weaknesses */}
          {((analysis.strengths?.length ?? 0) > 0 || (analysis.weaknesses?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analysis.strengths && analysis.strengths.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">Fortalezas</h4>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-gray-700 leading-snug">
                        <span className="text-green-500 shrink-0 mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Áreas de mejora</h4>
                  <ul className="space-y-1.5">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-2 text-xs text-gray-700 leading-snug">
                        <span className="text-amber-500 shrink-0 mt-0.5">△</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Strategic notes */}
          {analysis.strategy_notes && (
            <div className="rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] p-4">
              <h4 className="text-xs font-semibold text-[#1B2B5E] uppercase tracking-wide mb-2">Notas Estratégicas</h4>
              <p className="text-sm text-[#1e3a8a] leading-relaxed">{analysis.strategy_notes}</p>
            </div>
          )}

          {/* Recommended actions */}
          {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Acciones Recomendadas</h4>
              <ol className="space-y-2">
                {analysis.recommended_actions.map((action, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700 leading-snug">
                    <span className="shrink-0 font-mono text-xs text-gray-400 mt-0.5 w-5 text-right">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
