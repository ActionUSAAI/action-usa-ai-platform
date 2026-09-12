"use client";

import { useState } from "react";
import { ClipboardList, Loader2, Plus, Link2, Unlink, Pencil, Check, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EvidenceComposition, DocumentaryCondition, VerificationCondition } from "@/lib/evidence/types";

export interface EvidenceCaseDocument {
  id: string;
  name: string;
}

interface EvidenceSectionProps {
  caseId: string;
  userRole: string;
  initialCompositions: EvidenceComposition[];
  associations: Record<string, string[]>; // evidence_item_id -> document_id[]
  caseDocuments: EvidenceCaseDocument[];
}

const ALLOWED_ROLES = new Set(["admin", "supervisor", "agent"]);

const DOCUMENTARY_LABELS: Record<DocumentaryCondition, string> = {
  reported: "Reportado",
  partial: "Parcial",
  documented: "Documentado",
};

const VERIFICATION_BADGE: Record<VerificationCondition, { variant: "gray" | "success" | "danger"; label: string }> = {
  pending: { variant: "gray", label: "Pendiente" },
  verified: { variant: "success", label: "Verificado" },
  needs_attention: { variant: "danger", label: "Requiere atención" },
};

export function EvidenceSection({ caseId, userRole, initialCompositions, associations, caseDocuments }: EvidenceSectionProps) {
  const [compositions, setCompositions] = useState<EvidenceComposition[]>(initialCompositions);
  const [assoc, setAssoc] = useState<Record<string, string[]>>(associations);
  const [creating, setCreating] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [newCondition, setNewCondition] = useState<DocumentaryCondition>("reported");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [factDraft, setFactDraft] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  if (!ALLOWED_ROLES.has(userRole)) return null;

  const docName = (id: string) => caseDocuments.find((d) => d.id === id)?.name ?? id;

  async function callApi(path: string, options: RequestInit) {
    const res = await fetch(path, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
    return json;
  }

  async function handleCreate() {
    if (!newFact.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const json = await callApi(`/api/cases/${caseId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: newFact, documentary_condition: newCondition }),
      });
      setCompositions((prev) => [json.composition, ...prev]);
      setAssoc((prev) => ({ ...prev, [json.composition.id]: [] }));
      setNewFact("");
      setNewCondition("reported");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function handleAttach(compositionId: string, documentId: string) {
    setBusyId(compositionId);
    setErrorMsg(null);
    try {
      await callApi(`/api/cases/${caseId}/evidence/${compositionId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });
      setAssoc((prev) => ({ ...prev, [compositionId]: Array.from(new Set([...(prev[compositionId] ?? []), documentId])) }));
      setCompositions((prev) => prev.map((c) => (c.id === compositionId ? { ...c, probative_revision: c.probative_revision + 1 } : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDetach(compositionId: string, documentId: string) {
    setBusyId(compositionId);
    setErrorMsg(null);
    try {
      await callApi(`/api/cases/${caseId}/evidence/${compositionId}/documents/${documentId}`, { method: "DELETE" });
      setAssoc((prev) => ({ ...prev, [compositionId]: (prev[compositionId] ?? []).filter((d) => d !== documentId) }));
      setCompositions((prev) => prev.map((c) => (c.id === compositionId ? { ...c, probative_revision: c.probative_revision + 1 } : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  async function handleFactSave(compositionId: string) {
    setBusyId(compositionId);
    setErrorMsg(null);
    try {
      const json = await callApi(`/api/cases/${caseId}/evidence/${compositionId}/fact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: factDraft }),
      });
      setCompositions((prev) => prev.map((c) => (c.id === compositionId ? json.composition : c)));
      setEditingFactId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDocumentaryCondition(compositionId: string, condition: DocumentaryCondition) {
    setBusyId(compositionId);
    setErrorMsg(null);
    try {
      const json = await callApi(`/api/cases/${caseId}/evidence/${compositionId}/documentary-condition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentary_condition: condition }),
      });
      setCompositions((prev) => prev.map((c) => (c.id === compositionId ? json.composition : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReview(composition: EvidenceComposition, decision: VerificationCondition) {
    setBusyId(composition.id);
    setErrorMsg(null);
    try {
      const json = await callApi(`/api/cases/${caseId}/evidence/${composition.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_probative_revision: composition.probative_revision,
          expected_reviewed_at: composition.reviewed_at,
          verification_condition: decision,
          verification_reason: decision === "needs_attention" ? reviewReason : null,
        }),
      });
      setCompositions((prev) => prev.map((c) => (c.id === composition.id ? json.composition : c)));
      setReviewingId(null);
      setReviewReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      if (/STALE_PROBATIVE_SNAPSHOT/.test(msg)) {
        setErrorMsg("La evidencia subyacente cambió desde que la cargaste — recarga la página y revisa de nuevo.");
      } else if (/STALE_VERIFICATION_STATE/.test(msg)) {
        setErrorMsg("Otra persona ya revisó esta evidencia — recarga la página para ver la decisión actual.");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ClipboardList size={16} />
        Evidencia
        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{compositions.length}</span>
      </h3>

      {errorMsg && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={13} /> {errorMsg}
        </p>
      )}

      <div className="mb-5 space-y-2 rounded-lg border border-gray-100 p-3">
        <textarea
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          placeholder="Describe el hecho probatorio..."
          className="w-full rounded-md border border-gray-200 p-2 text-sm"
          rows={2}
        />
        <div className="flex items-center gap-2">
          <select
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value as DocumentaryCondition)}
            className="rounded-md border border-gray-200 p-1.5 text-xs"
          >
            {Object.entries(DOCUMENTARY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newFact.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Nueva evidencia
          </button>
        </div>
      </div>

      {compositions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No hay evidencia registrada.</p>
      ) : (
        <div className="space-y-3">
          {compositions.map((c) => {
            const isUnreviewed = !c.reviewed_at;
            const canMutate = c.currency_status === "current" && isUnreviewed;
            const attachedIds = assoc[c.id] ?? [];
            const attachableDocs = caseDocuments.filter((d) => !attachedIds.includes(d.id));
            const verifBadge = VERIFICATION_BADGE[c.verification_condition];
            const busy = busyId === c.id;

            return (
              <div key={c.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {editingFactId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={factDraft}
                          onChange={(e) => setFactDraft(e.target.value)}
                          className="flex-1 rounded-md border border-gray-200 p-1 text-sm"
                        />
                        <button onClick={() => handleFactSave(c.id)} disabled={busy} className="text-green-600 hover:text-green-700">
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">
                        {c.fact}
                        {canMutate && (
                          <button
                            onClick={() => { setEditingFactId(c.id); setFactDraft(c.fact); }}
                            className="ml-1.5 text-gray-400 hover:text-brand-blue"
                            title="Corregir hecho"
                          >
                            <Pencil size={11} className="inline" />
                          </button>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">v{c.version} · revisión {c.probative_revision} · {c.currency_status === "superseded" ? "histórico" : "actual"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={verifBadge.variant}>{verifBadge.label}</Badge>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Condición documental:</span>
                  {c.currency_status === "current" ? (
                    <select
                      value={c.documentary_condition}
                      onChange={(e) => handleDocumentaryCondition(c.id, e.target.value as DocumentaryCondition)}
                      disabled={busy}
                      className="rounded-md border border-gray-200 p-1 text-xs"
                    >
                      {Object.entries(DOCUMENTARY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="gray">{DOCUMENTARY_LABELS[c.documentary_condition]}</Badge>
                  )}
                </div>

                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Documentos asociados</p>
                  {attachedIds.length === 0 ? (
                    <p className="text-xs text-gray-400">Ninguno</p>
                  ) : (
                    <div className="space-y-1">
                      {attachedIds.map((docId) => (
                        <div key={docId} className="flex items-center justify-between text-xs">
                          <span className="truncate">{docName(docId)}</span>
                          {canMutate && (
                            <button onClick={() => handleDetach(c.id, docId)} disabled={busy} className="text-gray-400 hover:text-red-600">
                              <Unlink size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canMutate && attachableDocs.length > 0 && (
                    <select
                      onChange={(e) => { if (e.target.value) handleAttach(c.id, e.target.value); e.target.value = ""; }}
                      disabled={busy}
                      className="mt-1.5 w-full rounded-md border border-gray-200 p-1 text-xs"
                      defaultValue=""
                    >
                      <option value="" disabled>+ Adjuntar documento...</option>
                      {attachableDocs.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {c.currency_status === "current" && (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    {reviewingId === c.id ? (
                      <div className="space-y-1.5">
                        <input
                          value={reviewReason}
                          onChange={(e) => setReviewReason(e.target.value)}
                          placeholder="Motivo (requerido para 'Requiere atención')"
                          className="w-full rounded-md border border-gray-200 p-1.5 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleReview(c, "verified")}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            <ShieldCheck size={11} /> Verificado
                          </button>
                          <button
                            onClick={() => handleReview(c, "needs_attention")}
                            disabled={busy || !reviewReason.trim()}
                            className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            <ShieldAlert size={11} /> Requiere atención
                          </button>
                          <button onClick={() => setReviewingId(null)} className="text-xs text-gray-400">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReviewingId(c.id)} className="flex items-center gap-1 text-xs font-medium text-brand-blue">
                        <Link2 size={11} /> Revisar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
