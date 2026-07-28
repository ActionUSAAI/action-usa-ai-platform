"use client";

import { useState } from "react";
import { Compass, RefreshCw, Loader2, AlertCircle, Pencil, Check } from "lucide-react";
import { resolveCriteriaLabels } from "./a1-panel";

export interface CaseStrategy {
  id: string;
  case_id: string;
  status: "proposed" | "approved";
  theory_of_case: string;
  primary_narrative: string;
  secondary_narrative: string | null;
  dominant_criteria: string[];
  supporting_criteria: string[];
  corroborative_criteria: string[];
  evidence_dependencies: Record<string, string[]>;
  suggested_reinforcements: string[];
  recommended_document_order: string[];
  attorney_letter_outline: string[];
  recommended_exhibit_order: string[];
  criteria_cross_references: string[];
  edited_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface A5PanelProps {
  caseId: string;
  submissionId: string | null;
  initialStrategy: CaseStrategy | null;
  criteriaMet: Record<string, boolean> | null;
  criteriaScores: Record<string, number> | null;
  classificationUsed: string | null;
  userRole: string;
}

const STATUS_BADGE: Record<string, string> = {
  proposed: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const STATUS_LABEL: Record<string, string> = {
  proposed: "Propuesta — pendiente de revisión",
  approved: "Aprobada",
};

export function A5Panel({ caseId, submissionId, initialStrategy, criteriaMet, criteriaScores, classificationUsed, userRole }: A5PanelProps) {
  const [strategy, setStrategy] = useState<CaseStrategy | null>(initialStrategy);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");

  const canTrigger = ["admin", "supervisor", "agent"].includes(userRole);
  const labels = resolveCriteriaLabels(classificationUsed);

  async function generateStrategy() {
    if (!criteriaMet || !criteriaScores) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/a5-case-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, submission_id: submissionId, criteria_met: criteriaMet, criteria_scores: criteriaScores }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al generar la estrategia del caso");
      } else {
        setStrategy(data.strategy as CaseStrategy);
      }
    } catch {
      setError("Error de red al conectar con el agente A5");
    } finally {
      setLoading(false);
    }
  }

  async function saveField(key: string, value: string | string[]) {
    if (!strategy) return;
    try {
      const res = await fetch("/api/agents/a5-case-strategy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: strategy.id, updates: { [key]: value } }),
      });
      const data = await res.json();
      if (res.ok) {
        setStrategy(data.strategy as CaseStrategy);
      } else {
        setError(data.error ?? "Error al guardar el cambio");
      }
    } catch {
      setError("Error de red al guardar el cambio");
    } finally {
      setEditingKey(null);
    }
  }

  async function approveStrategy() {
    if (!strategy) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agents/a5-case-strategy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: strategy.id, approve: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setStrategy(data.strategy as CaseStrategy);
      } else {
        setError(data.error ?? "Error al aprobar la estrategia");
      }
    } catch {
      setError("Error de red al aprobar la estrategia");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(key: string, current: string | string[]) {
    setEditingKey(key);
    setDraftValue(Array.isArray(current) ? current.join("\n") : current ?? "");
  }

  function EditableText({ fieldKey, value, label }: { fieldKey: string; value: string | null; label: string }) {
    const isEditing = editingKey === fieldKey;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
          {canTrigger && !isEditing && (
            <button onClick={() => startEdit(fieldKey, value ?? "")} className="text-gray-400 hover:text-[#1B2B5E]">
              <Pencil size={14} />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-gray-200 p-2 text-sm"
              rows={3}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => saveField(fieldKey, draftValue)} className="flex items-center gap-1 rounded-lg bg-[#1B2B5E] px-3 py-1 text-xs text-white">
                <Check size={12} /> Guardar
              </button>
              <button onClick={() => setEditingKey(null)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || "—"}</p>
        )}
      </div>
    );
  }

  function EditableList({ fieldKey, value, label }: { fieldKey: string; value: string[]; label: string }) {
    const isEditing = editingKey === fieldKey;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
          {canTrigger && !isEditing && (
            <button onClick={() => startEdit(fieldKey, value)} className="text-gray-400 hover:text-[#1B2B5E]">
              <Pencil size={14} />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-gray-200 p-2 text-sm"
              rows={4}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder="Un elemento por línea"
            />
            <div className="flex gap-2">
              <button onClick={() => saveField(fieldKey, draftValue.split("\n").map(s => s.trim()).filter(Boolean))} className="flex items-center gap-1 rounded-lg bg-[#1B2B5E] px-3 py-1 text-xs text-white">
                <Check size={12} /> Guardar
              </button>
              <button onClick={() => setEditingKey(null)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-800">
            {value.length === 0 ? <li className="text-gray-400 list-none">—</li> : value.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="text-[#1B2B5E]" size={20} />
          <h2 className="text-lg font-semibold text-[#1B2B5E]">A5 — Case Strategy Engine</h2>
          {strategy && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[strategy.status]}`}>
              {STATUS_LABEL[strategy.status]}
            </span>
          )}
        </div>
        {canTrigger && criteriaMet && (
          <button
            onClick={generateStrategy}
            disabled={loading}
            className={strategy ? "flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50" : "rounded-lg bg-[#1B2B5E] px-3 py-1.5 text-sm text-white"}
          >
            {strategy && <RefreshCw size={14} />}
            {strategy ? "Regenerar" : "Generar Estrategia"}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="animate-spin text-[#1B2B5E]" size={28} />
          <p className="mt-2 text-sm text-gray-500">Construyendo el Case Blueprint...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !strategy && !criteriaMet && (
        <p className="py-6 text-center text-sm text-gray-400">Ejecuta el análisis A1 primero para generar la estrategia del caso.</p>
      )}

      {!loading && !strategy && criteriaMet && (
        <p className="py-6 text-center text-sm text-gray-400">El análisis A1 está listo. Genera la estrategia del caso con el botón de arriba.</p>
      )}

      {!loading && strategy && (
        <div className="space-y-6">
          <EditableText fieldKey="theory_of_case" value={strategy.theory_of_case} label="Theory of the Case" />
          <hr className="border-gray-100" />
          <EditableText fieldKey="primary_narrative" value={strategy.primary_narrative} label="Primary Narrative" />
          {strategy.secondary_narrative && (
            <EditableText fieldKey="secondary_narrative" value={strategy.secondary_narrative} label="Secondary Narrative" />
          )}
          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Dominant Criteria</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {strategy.dominant_criteria.map(k => (
                  <span key={k} className="rounded-full bg-[#1B2B5E] px-2 py-0.5 text-xs text-white">{labels[k] ?? k}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Supporting Criteria</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {strategy.supporting_criteria.map(k => (
                  <span key={k} className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">{labels[k] ?? k}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Corroborative Criteria</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {strategy.corroborative_criteria.map(k => (
                  <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{labels[k] ?? k}</span>
                ))}
              </div>
            </div>
          </div>
          <hr className="border-gray-100" />

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Evidence Dependencies</span>
            <div className="mt-2 space-y-2">
              {Object.entries(strategy.evidence_dependencies).map(([key, evidence]) => (
                <div key={key} className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs font-semibold text-gray-600">{labels[key] ?? key}</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <hr className="border-gray-100" />

          <EditableList fieldKey="suggested_reinforcements" value={strategy.suggested_reinforcements} label="Suggested Reinforcements" />
          <EditableList fieldKey="criteria_cross_references" value={strategy.criteria_cross_references} label="Cross-References Between Criteria" />
          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <EditableList fieldKey="recommended_document_order" value={strategy.recommended_document_order} label="Recommended Document Order" />
            <EditableList fieldKey="attorney_letter_outline" value={strategy.attorney_letter_outline} label="Attorney Letter Outline" />
            <EditableList fieldKey="recommended_exhibit_order" value={strategy.recommended_exhibit_order} label="Recommended Exhibit Order" />
          </div>

          {canTrigger && strategy.status === "proposed" && (
            <>
              <hr className="border-gray-100" />
              <button
                onClick={approveStrategy}
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Aprobar Case Blueprint
              </button>
              <p className="text-center text-xs text-gray-400">
                Aprobar esta estrategia habilita la generación de cartas Testimonial, Institucional, y del Motor Abogado.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
