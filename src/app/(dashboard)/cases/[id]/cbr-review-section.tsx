"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Eye } from "lucide-react";

// CBR Governed Confirmation & Promotion Flow — §J staff review surface.
// Displays OPENABLE G3 candidates (TX-03 entry points) and pending
// DECISIONs (TX-04/05 entry points), showing the immutable open-time
// snapshot separately from live current canonical, per the approved
// design. This is intentionally minimal, reusing this page's existing
// section-component convention (see intake-intelligence-section.tsx) —
// not a new portal.

interface OpenableCandidate {
  observationId: string;
  fieldKey: string;
  candidateValue: string | null;
  origin: string | null;
  // §J requires current canonical + origin displayed for every reviewable item, openable
  // candidates included, not only already-opened pending decisions.
  currentCanonical: string | null;
  createdAt: string;
  hasConflict: boolean;
  // §D: actual beneficiary confirmation timestamp, from the structured_profile snapshot on
  // the submission that produced this candidate — null when genuinely unknown (never fabricated).
  confirmationTimestamp: string | null;
}

type NotResolvableReason = "missing_data" | "stale";

interface PendingDecision {
  decisionId: string;
  fieldKey: string;
  decisionState: "pending" | "approved" | "rejected" | "superseded";
  candidateValue: string | null;
  expectedPriorValueAtOpen: string | null;
  currentCanonical: string | null;
  origin: string | null;
  createdAt: string;
  confirmationTimestamp: string | null;
  // §G RESOLVABLE (TX-04): pending AND source observation still CURRENT — advisory only,
  // TX-04's own server-side check is authoritative. Meaningless (always false) for non-pending.
  resolvable: boolean;
  // WHY not resolvable, when applicable — "stale" (a confirmed, genuinely newer submission
  // superseded the observation) vs "missing_data" (the observation link could not be resolved
  // at all, a data/integrity condition, never the same thing as a supersession). null when
  // resolvable, or not a pending decision.
  notResolvableReason: NotResolvableReason | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  supersededBySubmissionId: string | null;
}

const NOT_RESOLVABLE_EXPLANATION: Record<NotResolvableReason, string> = {
  stale: "Esta observación ya no es la más reciente para este campo (fue superada por un envío posterior). La aprobación no está disponible; puede rechazarla o recargar para ver el estado actual.",
  missing_data: "No fue posible confirmar el estado de vigencia de esta observación (datos de origen incompletos o no resueltos). La aprobación no está disponible hasta resolver esta inconsistencia; puede rechazarla si corresponde.",
};

// Corrected this round: the "(no disponible)" annotation at both call sites below previously
// keyed off the RAW STRING's truthiness (`!d.confirmationTimestamp`), not off whether formatting
// actually succeeded. The API's own extractConfirmedAt now rejects anything unparseable before it
// ever reaches this component, but this component's own annotation must not rely SOLELY on that
// upstream guarantee holding — it independently determines "ok" from whether `new Date(iso)`
// itself produced a genuinely renderable result, so the displayed text and the "unavailable"
// annotation can never disagree with each other regardless of what the API sends.
function formatTimestamp(iso: string | null): { text: string; ok: boolean } {
  if (!iso) return { text: "—", ok: false };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: "—", ok: false };
  return {
    text: d.toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    ok: true,
  };
}

const DECISION_STATE_LABEL: Record<string, string> = {
  approved: "Aprobada", rejected: "Rechazada", superseded: "Superada por un envío más reciente",
};

const FIELD_LABEL: Record<string, string> = {
  middleName: "Segundo nombre",
  dateOfBirth: "Fecha de nacimiento",
  firstName: "Nombre",
  lastName: "Apellido",
};

export function CbrReviewSection({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openable, setOpenable] = useState<OpenableCandidate[]>([]);
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cbr/pending-reviews?clientId=${clientId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar revisiones CBR");
      setOpenable(data.openable ?? []);
      setDecisions(data.decisions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function openReview(observationId: string) {
    setBusyId(observationId);
    try {
      const res = await fetch("/api/cbr/review/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.outcome !== "OPENED") throw new Error(`No se pudo abrir la revisión: ${data.outcome}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  // The submitted expectedPriorValue is EXACTLY the currentCanonical value
  // this component already fetched and is displaying — never re-read fresh
  // from the server at click time. If the reviewer wants a guaranteed-fresh
  // check, they must reload (which re-fetches and re-displays) before
  // approving — the stale-detection itself happens server-side in TX-04.
  async function approve(decision: PendingDecision) {
    setBusyId(decision.decisionId);
    try {
      const res = await fetch("/api/cbr/review/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.decisionId, expectedPriorValue: decision.currentCanonical }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.outcome !== "APPROVED") throw new Error(`No aprobado: ${data.outcome}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(decision: PendingDecision) {
    setBusyId(decision.decisionId);
    try {
      const res = await fetch("/api/cbr/review/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.decisionId, reason: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.outcome !== "REJECTED") throw new Error(`No rechazado: ${data.outcome}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando revisiones CBR…
      </div>
    );
  }

  if (openable.length === 0 && decisions.length === 0 && !error) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">Revisión de Identidad Canónica (CBR)</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {decisions.filter((d) => d.decisionState === "pending").length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">Revisiones pendientes</p>
          {decisions.filter((d) => d.decisionState === "pending").map((d) => {
            const confirmedAt = formatTimestamp(d.confirmationTimestamp);
            return (
            <div key={d.decisionId} className="border border-amber-200 bg-amber-50 rounded p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{FIELD_LABEL[d.fieldKey] ?? d.fieldKey}</div>
                {d.resolvable ? (
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">Lista para decidir</span>
                ) : (
                  <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">No aprobable por ahora</span>
                )}
              </div>
              <div>Candidato: <span className="font-mono">{d.candidateValue ?? "—"}</span></div>
              <div className="text-gray-500">
                Confirmado por el beneficiario: <span className="font-mono">{confirmedAt.text}</span>
                {!confirmedAt.ok && <span className="ml-1 text-gray-400">(no disponible)</span>}
              </div>
              <div className="text-gray-500">
                Instantánea al abrir la revisión (histórica, inmutable): <span className="font-mono">{d.expectedPriorValueAtOpen ?? "—"}</span>
              </div>
              <div className="text-gray-500">
                Valor canónico actual (en vivo): <span className="font-mono">{d.currentCanonical ?? "—"}</span>
              </div>
              {d.origin && <div className="text-gray-400 text-xs">Origen: {d.origin}</div>}
              {!d.resolvable && d.notResolvableReason && (
                <div className="text-xs text-red-700">
                  {NOT_RESOLVABLE_EXPLANATION[d.notResolvableReason]}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => approve(d)}
                  disabled={busyId === d.decisionId || !d.resolvable}
                  title={d.resolvable ? undefined : (d.notResolvableReason ? NOT_RESOLVABLE_EXPLANATION[d.notResolvableReason] : "No disponible")}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" /> Aprobar
                </button>
                <button
                  onClick={() => reject(d)}
                  disabled={busyId === d.decisionId}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs disabled:opacity-50"
                >
                  <XCircle className="w-3 h-3" /> Rechazar
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {decisions.filter((d) => d.decisionState !== "pending").length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Historial de decisiones</p>
          {decisions.filter((d) => d.decisionState !== "pending").map((d) => (
            <div key={d.decisionId} className="border border-gray-100 rounded p-2 text-xs space-y-0.5 text-gray-600">
              <div className="font-medium text-gray-800">{FIELD_LABEL[d.fieldKey] ?? d.fieldKey} — {DECISION_STATE_LABEL[d.decisionState] ?? d.decisionState}</div>
              <div>Valor: <span className="font-mono">{d.candidateValue ?? "—"}</span></div>
              {d.decisionState === "superseded" ? (
                <div>Superada por el envío: <span className="font-mono">{d.supersededBySubmissionId ?? "—"}</span> — sin revisor humano asignado (no aplica).</div>
              ) : (
                <div>Revisor: {d.reviewedBy ?? "—"} · {d.reviewedAt ?? "—"}</div>
              )}
              {d.decisionReason && <div>Motivo: {d.decisionReason}</div>}
            </div>
          ))}
        </div>
      )}

      {openable.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Candidatos listos para revisión</p>
          {openable.map((o) => {
            const confirmedAt = formatTimestamp(o.confirmationTimestamp);
            return (
            <div key={o.observationId} className="flex items-center justify-between border border-gray-200 rounded p-2 text-sm">
              <div>
                <span className="font-medium">{FIELD_LABEL[o.fieldKey] ?? o.fieldKey}</span>
                {": "}
                <span className="font-mono">{o.candidateValue ?? "—"}</span>
                {o.hasConflict && <span className="ml-2 text-xs text-red-600">conflicto</span>}
                <div className="text-xs text-gray-500">
                  Valor canónico actual (en vivo): <span className="font-mono">{o.currentCanonical ?? "—"}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Origen: {o.origin ?? "desconocido"}
                </div>
                <div className="text-xs text-gray-500">
                  Confirmado por el beneficiario: {confirmedAt.text}
                  {!confirmedAt.ok && <span className="ml-1 text-gray-400">(no disponible)</span>}
                </div>
              </div>
              <button
                onClick={() => openReview(o.observationId)}
                disabled={busyId === o.observationId}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
              >
                <Eye className="w-3 h-3" /> Abrir revisión
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
