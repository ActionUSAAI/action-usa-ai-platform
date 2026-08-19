"use client";

import { useState } from "react";
import { Compass, RefreshCw, Loader2, AlertCircle, Pencil, Check } from "lucide-react";
import { resolveCriteriaLabels } from "./legal-decision-section";

export interface CrossReference {
  criteria: [string, string];
  connection: string;
}

export interface FoundationalEvidenceItem {
  evidence_item_id: string | null;
  description: string;
  why_foundational: string;
}

export interface CaseStrategy {
  id: string;
  case_id: string;
  status: "proposed" | "edited" | "approved" | "locked" | "superseded";
  theory_of_case: string;
  primary_narrative: string;
  secondary_narrative: string | null;
  dominant_criteria: string[];
  supporting_criteria: string[];
  corroborative_criteria: string[];
  foundational_evidence: FoundationalEvidenceItem[];
  evidence_dependencies: Record<string, string[]>;
  evidence_priority: Record<string, string[]> | null;
  argument_sequence: string[];
  // Nombre de columna sin cambiar respecto a v1 — el tipo de contenido sí
  // cambió (Blueprint Field Audit): antes string[], ahora CrossReference[].
  criteria_cross_references: CrossReference[];
  strategic_priorities: string[];
  // Nombre de columna sin cambiar respecto a v1 — almacena
  // reinforcement_opportunities (Blueprint Specification v2).
  suggested_reinforcements: string[];
  missing_evidence_links: string[];
  review_notes: string | null;
  edited_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface BlueprintLifecycleSectionProps {
  caseId: string;
  submissionId: string | null;
  initialStrategy: CaseStrategy | null;
  classificationUsed: string | null;
  userRole: string;
}

const STATUS_BADGE: Record<string, string> = {
  proposed: "bg-amber-50 text-amber-700 border border-amber-200",
  edited: "bg-blue-50 text-blue-700 border border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  locked: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  superseded: "bg-gray-100 text-gray-500 border border-gray-200",
};
const STATUS_LABEL: Record<string, string> = {
  proposed: "Propuesta — pendiente de revisión",
  edited: "Editada — pendiente de aprobación",
  approved: "Aprobada",
  locked: "Bloqueada",
  superseded: "Reemplazada por una versión más reciente",
};

export function BlueprintLifecycleSection({ caseId, submissionId, initialStrategy, classificationUsed, userRole }: BlueprintLifecycleSectionProps) {
  const [strategy, setStrategy] = useState<CaseStrategy | null>(initialStrategy);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const canTrigger = ["admin", "supervisor", "agent"].includes(userRole);
  const labels = resolveCriteriaLabels(classificationUsed);

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

  const canApprove = strategy && (strategy.status === "proposed" || strategy.status === "edited");

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="text-[#1B2B5E]" size={20} />
          <h2 className="text-lg font-semibold text-[#1B2B5E]">Blueprint Lifecycle</h2>
          {strategy && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[strategy.status] ?? STATUS_BADGE.proposed}`}>
              {STATUS_LABEL[strategy.status] ?? strategy.status}
            </span>
          )}
        </div>
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
      {!loading && !strategy && (
        <p className="py-6 text-center text-sm text-gray-400">
          Todavía no existe un Blueprint para este caso. Genera uno desde la sección Legal Decision.
        </p>
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

          {/* Foundational Evidence — nuevo en v2, solo lectura (estructura de
              objetos, no compatible con EditableText/EditableList). */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Foundational Evidence</span>
            <div className="mt-2 space-y-2">
              {strategy.foundational_evidence.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                strategy.foundational_evidence.map((item, i) => {
                  if (!item || typeof item !== "object" || !("description" in item)) {
                    return (
                      <p key={i} className="text-sm text-gray-600 italic">
                        (formato anterior — regenera la estrategia para ver el formato actualizado)
                      </p>
                    );
                  }
                  return (
                    <div key={i} className="rounded-lg bg-gray-50 p-2">
                      <p className="text-sm text-gray-800">{item.description}</p>
                      <p className="mt-1 text-xs text-gray-500">Por qué ancla el caso: {item.why_foundational}</p>
                    </div>
                  );
                })
              )}
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

          {/* Evidence Priority — Deferred (Blueprint Field Audit), solo se
              muestra si el modelo lo produjo. */}
          {strategy.evidence_priority && Object.keys(strategy.evidence_priority).length > 0 && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Evidence Priority</span>
              <div className="mt-2 space-y-2">
                {Object.entries(strategy.evidence_priority).map(([key, evidence]) => (
                  <div key={key} className="rounded-lg bg-gray-50 p-2">
                    <p className="text-xs font-semibold text-gray-600">{labels[key] ?? key}</p>
                    <ol className="list-decimal list-inside text-sm text-gray-700">
                      {evidence.map((e, i) => <li key={i}>{e}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}
          <hr className="border-gray-100" />

          <EditableList fieldKey="argument_sequence" value={strategy.argument_sequence} label="Argument Sequence" />

          {/* Cross References — nuevo tipo estructurado en v2, solo lectura.
              Guarda defensiva: filas generadas antes del despliegue de
              Blueprint v2 (commit 1c7621a) siguen en formato string[] en
              la base de datos — no se regeneran automáticamente. Sin esta
              guarda, ref.criteria[0] sobre un string lanza TypeError y
              rompe el panel completo (bug real detectado 2026-08-08,
              caso real en producción). */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Cross-References Between Criteria</span>
            <div className="mt-2 space-y-1">
              {strategy.criteria_cross_references.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                strategy.criteria_cross_references.map((ref, i) => {
                  const isLegacyFormat = typeof ref === "string" || !ref || !Array.isArray((ref as CrossReference).criteria);
                  if (isLegacyFormat) {
                    return (
                      <p key={i} className="text-sm text-gray-600 italic">
                        {typeof ref === "string" ? ref : "(formato anterior — regenera la estrategia para ver el formato actualizado)"}
                      </p>
                    );
                  }
                  return (
                    <p key={i} className="text-sm text-gray-800">
                      <span className="font-medium">{labels[ref.criteria[0]] ?? ref.criteria[0]}</span>
                      {" ↔ "}
                      <span className="font-medium">{labels[ref.criteria[1]] ?? ref.criteria[1]}</span>
                      {": "}{ref.connection}
                    </p>
                  );
                })
              )}
            </div>
          </div>

          {/* Strategic Priorities — Deferred (Blueprint Field Audit), solo se
              muestra si el modelo lo produjo. */}
          {strategy.strategic_priorities.length > 0 && (
            <EditableList fieldKey="strategic_priorities" value={strategy.strategic_priorities} label="Strategic Priorities" />
          )}

          <EditableList fieldKey="suggested_reinforcements" value={strategy.suggested_reinforcements} label="Reinforcement Opportunities" />
          <EditableList fieldKey="missing_evidence_links" value={strategy.missing_evidence_links} label="Missing Evidence Links" />

          {/* Review Notes — Deferred (Blueprint Field Audit), espacio del
              abogado; siempre editable, nunca lo produce A5. */}
          <EditableText fieldKey="review_notes" value={strategy.review_notes} label="Review Notes (abogado)" />

          {canTrigger && canApprove && (
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
