"use client";

import { useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, MessageSquare, Pencil, Check, Unlink, X } from "lucide-react";
import { resolveIncorporationCandidates } from "@/lib/evidence/structured-profile-incorporation";

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

export interface StructuredProfileEvidenceView {
  id: string;
  fact: string;
  source_reference: string | null;
  verification_condition: string;
}

interface IntakeIntelligenceSectionProps {
  caseId: string;
  submissionId: string | null;
  status: string | null;
  structuredProfile: Record<string, StructuredProfileFieldView> | null;
  coachTurns: number;
  structuredProfileEvidence: StructuredProfileEvidenceView[];
  evidenceDocumentAssociations: Record<string, string[]>;
  caseDocuments: { id: string; name: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", submitted: "Enviado", processing: "Procesando", complete: "Completo",
};

const REASON_LABEL: Record<string, string> = {
  missing_identity_information: "Faltan campos de identidad requeridos",
  coach_not_completed: "El beneficiario no completó la conversación con el Coach",
  unresolved_structured_profile_conflict: "Hay información en conflicto sin resolver en el Perfil Estructurado",
};

const VERIFICATION_LABEL: Record<string, string> = {
  pending: "Pendiente", verified: "Verificado", needs_attention: "Requiere atención",
};

export function IntakeIntelligenceSection({
  caseId, submissionId, status, structuredProfile, coachTurns,
  structuredProfileEvidence, evidenceDocumentAssociations, caseDocuments,
}: IntakeIntelligenceSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [incorporating, setIncorporating] = useState(false);
  const [incorporationMsg, setIncorporationMsg] = useState<string | null>(null);
  const [factDraft, setFactDraft] = useState<Record<string, string>>({});
  const [creatingField, setCreatingField] = useState<string | null>(null);
  // MR-F04 (reject): purely local, non-persistent per-session dismissal --
  // Evidence Item Contract V2 §19's "reject" action has no durable state
  // established anywhere in source (Final Exact Design §31 leaves exact UI
  // mechanics implementation-determined); the entire effect of rejecting a
  // candidate is that no Evidence Item is created for it, which is already
  // true by simply not acting. This just makes the decision explicit and
  // removes the candidate from view for the remainder of the session.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctDraft, setCorrectDraft] = useState("");
  const [busyEvidenceId, setBusyEvidenceId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<StructuredProfileEvidenceView[]>(structuredProfileEvidence);
  const [assoc, setAssoc] = useState<Record<string, string[]>>(evidenceDocumentAssociations);

  // MR-F02: synchronous per-field token/in-flight guards (useRef, not
  // useState) -- a rapid double-click must not be able to generate two
  // action tokens or fire two requests for one logical Create action,
  // which asynchronous React state alone cannot prevent (state commits
  // after, not before, a second event handler invocation).
  const tokensRef = useRef<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  if (!submissionId) return null;

  const fields = Object.entries(structuredProfile ?? {}).filter(([, f]) => f.status !== "not_yet_acquired");
  const conflicting = fields.filter(([, f]) => f.status === "conflicting").length;
  const confirmed = fields.filter(([, f]) => f.status === "beneficiary_confirmed").length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = resolveIncorporationCandidates((structuredProfile ?? {}) as any);
  const deterministicCandidates = candidates.filter(c => c.path === "deterministic");
  const humanCandidates = candidates.filter(c => c.path === "human_resolution" && !dismissed.has(c.fieldKey));

  function tokenFor(fieldKey: string): string {
    if (!tokensRef.current[fieldKey]) tokensRef.current[fieldKey] = crypto.randomUUID();
    return tokensRef.current[fieldKey];
  }

  // MR-F03: existing Evidence already traceable to a candidate, via the
  // governed source_reference prefix (§18) -- shown to staff for context
  // before they act. Deterministic, provenance-based; no semantic matching.
  function relatedEvidence(fieldKey: string): StructuredProfileEvidenceView[] {
    const prefix = `${submissionId}:${fieldKey}:`;
    return evidence.filter(e => (e.source_reference ?? "").startsWith(prefix));
  }

  async function incorporateDeterministic() {
    setIncorporating(true);
    setIncorporationMsg(null);
    try {
      const res = await fetch("/api/intake-intelligence/incorporate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, submission_id: submissionId, mode: "deterministic" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIncorporationMsg(json.error ?? "Error al incorporar evidencia");
      } else {
        setIncorporationMsg(`${json.results?.length ?? 0} campo(s) de identidad procesados como Evidence.`);
      }
    } catch {
      setIncorporationMsg("Error de red");
    } finally {
      setIncorporating(false);
    }
  }

  // MR-F01: the submitted fact must equal the effective fact visibly
  // presented to staff (factDraft[fieldKey] ?? candidate.value) unless
  // staff deliberately edits it -- previously read only the raw,
  // non-fallback factDraft state, causing a silent no-op.
  async function createHumanEvidence(fieldKey: string) {
    if (inFlightRef.current.has(fieldKey)) return;
    const candidate = humanCandidates.find(c => c.fieldKey === fieldKey);
    const fact = factDraft[fieldKey] ?? candidate?.value;
    if (!fact) return;
    inFlightRef.current.add(fieldKey);
    setCreatingField(fieldKey);
    setIncorporationMsg(null);
    try {
      const res = await fetch("/api/intake-intelligence/incorporate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId, submission_id: submissionId, mode: "human",
          field_key: fieldKey, action_token: tokenFor(fieldKey), fact,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIncorporationMsg(json.error ?? "Error al crear Evidence");
      } else {
        setIncorporationMsg(`Evidence creado para "${fieldKey}".`);
        delete tokensRef.current[fieldKey];
        setFactDraft(prev => { const next = { ...prev }; delete next[fieldKey]; return next; });
        if (json.composition) {
          setEvidence(prev => [...prev, {
            id: json.composition.id, fact: json.composition.fact,
            source_reference: json.composition.source_reference,
            verification_condition: json.composition.verification_condition,
          }]);
        }
      }
    } catch {
      setIncorporationMsg("Error de red");
    } finally {
      inFlightRef.current.delete(fieldKey);
      setCreatingField(null);
    }
  }

  function dismissCandidate(fieldKey: string) {
    setDismissed(prev => new Set(prev).add(fieldKey));
  }

  // MR-F04 (correct): reuses the existing, unmodified FC-A fact-correction
  // route/RPC (update_evidence_fact) -- identical pattern to evidence-section.tsx.
  async function correctEvidence(evidenceId: string) {
    if (!correctDraft.trim()) return;
    setBusyEvidenceId(evidenceId);
    setIncorporationMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}/fact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: correctDraft }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIncorporationMsg(json.error ?? "Error al corregir Evidence");
      } else {
        setEvidence(prev => prev.map(e => (e.id === evidenceId ? { ...e, fact: json.composition.fact } : e)));
        setCorrectingId(null);
      }
    } catch {
      setIncorporationMsg("Error de red");
    } finally {
      setBusyEvidenceId(null);
    }
  }

  // MR-F04 (associate/unlink): reuses the existing, unmodified Evidence
  // ↔ Document M:N routes -- identical pattern to evidence-section.tsx.
  async function associateDocument(evidenceId: string, documentId: string) {
    setBusyEvidenceId(evidenceId);
    setIncorporationMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIncorporationMsg(json.error ?? "Error al asociar documento");
      } else {
        setAssoc(prev => ({ ...prev, [evidenceId]: Array.from(new Set([...(prev[evidenceId] ?? []), documentId])) }));
      }
    } catch {
      setIncorporationMsg("Error de red");
    } finally {
      setBusyEvidenceId(null);
    }
  }

  async function unlinkDocument(evidenceId: string, documentId: string) {
    setBusyEvidenceId(evidenceId);
    setIncorporationMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setIncorporationMsg(json.error ?? "Error al desvincular documento");
      } else {
        setAssoc(prev => ({ ...prev, [evidenceId]: (prev[evidenceId] ?? []).filter(d => d !== documentId) }));
      }
    } catch {
      setIncorporationMsg("Error de red");
    } finally {
      setBusyEvidenceId(null);
    }
  }

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

      {(deterministicCandidates.length > 0 || humanCandidates.length > 0) && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Incorporación a Evidence</p>

          {deterministicCandidates.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-600">{deterministicCandidates.length} campo(s) de identidad listos para incorporar.</p>
              <button type="button" onClick={incorporateDeterministic} disabled={incorporating}
                className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
                {incorporating ? "Incorporando…" : "Incorporar identidad"}
              </button>
            </div>
          )}

          {humanCandidates.length > 0 && (
            <ul className="mt-3 space-y-2">
              {humanCandidates.map(c => {
                const related = relatedEvidence(c.fieldKey);
                return (
                  <li key={c.fieldKey} className="rounded-md border border-gray-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700">{c.fieldKey} <span className="font-normal text-gray-400">({c.source})</span></p>
                        <p className="mt-0.5 text-xs text-gray-500">{c.value}</p>
                      </div>
                      <button type="button" onClick={() => dismissCandidate(c.fieldKey)}
                        className="shrink-0 text-gray-300 hover:text-gray-500" title="Descartar">
                        <X size={12}/>
                      </button>
                    </div>

                    {related.length > 0 && (
                      <div className="mt-1.5 space-y-1.5 rounded bg-gray-50 p-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Evidence existente</p>
                        {related.map(e => (
                          <div key={e.id} className="text-xs">
                            {correctingId === e.id ? (
                              <div className="flex items-center gap-1">
                                <input value={correctDraft} onChange={ev => setCorrectDraft(ev.target.value)}
                                  className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs"/>
                                <button type="button" onClick={() => correctEvidence(e.id)} disabled={busyEvidenceId === e.id}
                                  className="text-green-600 hover:text-green-700"><Check size={12}/></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate text-gray-700">{e.fact} <span className="text-gray-400">({VERIFICATION_LABEL[e.verification_condition] ?? e.verification_condition})</span></span>
                                <button type="button" onClick={() => { setCorrectingId(e.id); setCorrectDraft(e.fact); }}
                                  className="shrink-0 text-gray-400 hover:text-brand-blue" title="Corregir">
                                  <Pencil size={10}/>
                                </button>
                              </div>
                            )}
                            {(assoc[e.id] ?? []).map(docId => (
                              <div key={docId} className="ml-2 mt-0.5 flex items-center justify-between text-[11px] text-gray-500">
                                <span className="truncate">{caseDocuments.find(d => d.id === docId)?.name ?? docId}</span>
                                <button type="button" onClick={() => unlinkDocument(e.id, docId)} disabled={busyEvidenceId === e.id}
                                  className="shrink-0 text-gray-400 hover:text-red-600" title="Desvincular">
                                  <Unlink size={10}/>
                                </button>
                              </div>
                            ))}
                            {caseDocuments.filter(d => !(assoc[e.id] ?? []).includes(d.id)).length > 0 && (
                              <select onChange={ev => { if (ev.target.value) associateDocument(e.id, ev.target.value); ev.target.value = ""; }}
                                disabled={busyEvidenceId === e.id} defaultValue=""
                                className="ml-2 mt-0.5 w-[calc(100%-0.5rem)] rounded border border-gray-200 text-[11px]">
                                <option value="" disabled>+ Asociar documento…</option>
                                {caseDocuments.filter(d => !(assoc[e.id] ?? []).includes(d.id)).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input type="text" placeholder="Texto del hecho probatorio…"
                        value={factDraft[c.fieldKey] ?? c.value}
                        onChange={e => setFactDraft(prev => ({ ...prev, [c.fieldKey]: e.target.value }))}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"/>
                      <button type="button" onClick={() => createHumanEvidence(c.fieldKey)} disabled={creatingField === c.fieldKey}
                        className="rounded bg-brand-blue px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
                        {creatingField === c.fieldKey ? "…" : "Crear Evidence"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {incorporationMsg && <p className="mt-2 text-xs text-gray-600">{incorporationMsg}</p>}
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
