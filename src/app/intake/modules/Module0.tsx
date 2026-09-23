"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { Paperclip, X, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { IntakeTokenContext } from "../primitives";
import type { Module0 as Module0Data, CoachTurn } from "../types";
import {
  acquireField, acquireCoachFields, confirmField, ALL_STRUCTURED_PROFILE_FIELDS,
  IDENTITY_FIELDS, hasAnyAcquiredInformation, minimizedProfileContext,
} from "@/lib/intake/structured-profile";

// Module0 -- CV/résumé source document + integrated Coach discovery
// (AUSCIS Intake Intelligence Layer, CR-CPS-34/35, design §5.2/§5.1).
// Two decoupled mandatory tracks (CR-CPS-33/34 topology refinement):
// uploading an existing CV never exempts the beneficiary from Coach.

const FIELD_LABELS: Record<string, string> = {
  familyName: "Apellido(s)", givenName: "Nombre(s)", middleName: "Segundo nombre",
  dateOfBirth: "Fecha de nacimiento", nationalities: "Nacionalidad(es)",
  countryOfResidence: "País de residencia", cityOfResidence: "Ciudad de residencia",
  email: "Email", whatsapp: "WhatsApp", profession: "Profesión", industry: "Industria",
  yearsExperience: "Años de experiencia",
  awards: "Premios y reconocimientos", memberships: "Membresías profesionales",
  media_coverage: "Cobertura de medios", judging: "Jurado/evaluación de otros",
  original_contributions: "Contribuciones originales", scholarly_articles: "Artículos académicos",
  critical_role: "Roles críticos/de liderazgo", high_salary: "Compensación",
  artistic_exhibitions: "Exhibiciones/éxito comercial artístico",
};

export function Module0({ data, onChange, onCheckpoint, sessionId, errors }: {
  data: Module0Data;
  onChange: (d: Module0Data) => void;
  // P7-R4 (CR-CPS-60): deterministic checkpoint for the three meaningful
  // events (A0 completion, Confirmar, complete Coach turn) whose loss
  // would repeat billable work or lose an explicit beneficiary decision.
  // Parallel to onChange, not a replacement for it -- IntakeForm's
  // wiring performs the equivalent of onChange as its own final step.
  onCheckpoint: (d: Module0Data) => void;
  sessionId: string;
  errors: Record<string, string>;
}) {
  const token = useContext(IntakeTokenContext);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // CR-CPS-57 §11: local UI state only, no new persistence -- reopens the
  // existing disabled input/Confirmar toggle for a beneficiary-initiated
  // correction of an already-confirmed field. Automated Coach protection
  // (acquireCoachFields) is entirely independent of this and unaffected.
  const [reopenedFields, setReopenedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.coachConversation.length]);

  async function runA0(filePath: string) {
    setExtracting(true);
    try {
      const res = await fetch("/api/intake/a0-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, filePath }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Upload already succeeded (filePath is set); extraction
        // failure is surfaced separately and does not lose the upload.
        setUploadError(json.error || "No se pudo extraer información del documento. Puedes continuar y completar la información manualmente.");
        return;
      }
      let profile = data.structuredProfile;
      for (const [key, f] of Object.entries(json.fields as Record<string, { value: string; confidence: "high" | "medium" | "low" }>)) {
        profile = { ...profile, [key]: acquireField(profile[key], { value: f.value, source: "cv_extraction", confidence: f.confidence }) };
      }
      // CP-01 (P7-R4, CR-CPS-60): deterministic checkpoint of the exact
      // post-merge state -- losing it would repeat billable A0 extraction.
      onCheckpoint({ ...data, structuredProfile: profile });
    } catch {
      setUploadError("No se pudo extraer información del documento. Puedes continuar y completar la información manualmente.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, source: "existing" | "coach") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadError("El archivo no puede exceder 10MB."); return; }
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", "module0/cv");
      fd.append("sessionId", sessionId || "tmp");
      fd.append("token", token);
      const res = await fetch("/api/intake/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir");
      onChange({ ...data, cvFilePath: json.filePath, cvFileName: json.fileName, cvSource: source });
      // A0 automatic trigger (DDR-TRIGGER-01): fires immediately on
      // successful upload, no manual "extract" step.
      runA0(json.filePath);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir el archivo");
    }
  }

  function removeCv() {
    onChange({ ...data, cvFilePath: "", cvFileName: "", cvSource: "" });
  }

  async function sendCoachMessage() {
    const message = chatInput.trim();
    if (!message || sending) return;
    setSending(true);
    setChatInput("");
    const userTurn: CoachTurn = { role: "user", content: message, at: new Date().toISOString() };
    const historyForApi = data.coachConversation.map(t => ({ role: t.role, content: t.content }));
    onChange({ ...data, coachConversation: [...data.coachConversation, userTurn] });
    try {
      const res = await fetch("/api/intake/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // CR-CPS-57 §7: minimized Structured Profile context (value/status
        // only, computed client-side) so Coach can avoid redundant
        // acquisition and prioritize criterion-relevant follow-up.
        body: JSON.stringify({ token, history: historyForApi, message, profileContext: minimizedProfileContext(data.structuredProfile) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      const assistantTurn: CoachTurn = { role: "assistant", content: json.reply, at: new Date().toISOString() };
      // CR-CPS-57 D-03: acquireCoachFields() structurally protects any
      // beneficiary-confirmed Class A1 fact from this automated merge.
      const profile = acquireCoachFields(data.structuredProfile, (json.fields ?? {}) as Record<string, { value: string; confidence: "high" | "medium" | "low" }>);
      // CP-03 (P7-R4, CR-CPS-60): deterministic checkpoint of the
      // complete successful turn -- losing it would repeat a billable
      // Coach/Anthropic call. An errored/incomplete turn (catch branch
      // below) does not receive this checkpoint.
      onCheckpoint({ ...data, coachConversation: [...data.coachConversation, userTurn, assistantTurn], structuredProfile: profile });
    } catch {
      const errTurn: CoachTurn = { role: "assistant", content: "No pude procesar tu respuesta. Intenta de nuevo.", at: new Date().toISOString() };
      onChange({ ...data, coachConversation: [...data.coachConversation, userTurn, errTurn] });
    } finally {
      setSending(false);
    }
  }

  function confirmProfileField(key: string, correctedValue?: string) {
    // CP-02 (P7-R4, CR-CPS-60): deterministic checkpoint of the exact
    // post-confirmation state -- losing it would lose an explicit
    // beneficiary decision (confirmed_by/confirmed_at). Synchronous, no
    // await, so `data` here is guaranteed current.
    onCheckpoint({ ...data, structuredProfile: { ...data.structuredProfile, [key]: confirmField(data.structuredProfile[key], "beneficiary", correctedValue) } });
  }

  const acquiredFields = ALL_STRUCTURED_PROFILE_FIELDS.filter(k => data.structuredProfile[k]?.status !== "not_yet_acquired");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          AUSCIS usará este documento y la conversación con el Coach para conocer tu trayectoria profesional y ayudarte a completar el resto del formulario más rápido. Esto no determina si calificas para ningún trámite -- eso lo hace nuestro equipo legal después.
        </p>
      </div>

      {/* CV / résumé upload -- optional acquisition accelerator (R-01, CR-CPS-37/38) */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-brand-blue">1. ¿Tienes un CV, currículum o perfil profesional? <span className="font-normal text-gray-400">(opcional)</span></h3>
        <p className="text-xs text-gray-500">Si ya tienes uno, puedes subirlo para que AUSCIS extraiga información y acelere el proceso. Si no tienes uno, no hay problema -- puedes continuar y el Coach te ayudará a descubrir y estructurar la información necesaria.</p>
        {data.cvFileName ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <span className="flex-1 truncate text-sm text-green-800">{data.cvFileName}</span>
            {extracting && <span className="text-xs text-gray-500">Analizando…</span>}
            <button type="button" onClick={removeCv} className="flex items-center gap-1 rounded text-xs text-green-600 hover:text-red-500 transition-colors">
              <X size={13}/> Quitar
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-brand-blue/40 px-3 py-2.5 hover:border-brand-blue hover:bg-brand-blue/5 transition-colors">
            <Paperclip size={14} className="text-brand-blue"/>
            <span className="text-sm text-brand-blue">Seleccionar archivo (PDF, JPG, PNG)</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => handleUpload(e, "existing")}/>
          </label>
        )}
        {uploadError && (
          <p className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={11}/> {uploadError}</p>
        )}
      </div>

      {/* Coach conversation */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-brand-blue">2. Conversa con el Coach</h3>
        <p className="text-xs text-gray-500">El Coach te hará preguntas para entender mejor tu experiencia -- incluso si ya subiste un CV. Esto no reemplaza tu CV, lo complementa.</p>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
          {data.coachConversation.length === 0 && (
            <p className="text-xs text-gray-400">Escribe un mensaje para comenzar. Por ejemplo: cuéntanos brevemente a qué te dedicas.</p>
          )}
          {data.coachConversation.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${t.role === "user" ? "bg-brand-blue text-white" : "bg-white border border-gray-200 text-gray-700"}`}>
                {t.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={chatInput} disabled={sending}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendCoachMessage(); } }}
            placeholder="Escribe tu respuesta…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={sendCoachMessage} disabled={sending || !chatInput.trim()}
            className="flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-2 text-sm text-white disabled:opacity-40">
            <Send size={14}/>
          </button>
        </div>
        {data.coachConversation.length > 0 && !data.coachAcknowledged && (
          <button type="button" onClick={() => onChange({ ...data, coachAcknowledged: true })}
            className="text-xs font-medium text-brand-blue hover:underline">
            He terminado de conversar con el Coach
          </button>
        )}
        {data.coachAcknowledged && (
          <p className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12}/> Conversación con el Coach completada.</p>
        )}
        {errors.coach && <p className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={11}/> {errors.coach}</p>}
      </div>

      {/* Structured Profile review (design §5.7 -- beneficiary reviews first) */}
      {hasAnyAcquiredInformation(data.structuredProfile) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-blue">3. Revisa lo que encontramos</h3>
          <p className="text-xs text-gray-500">Confirma que esta información es correcta, o corrígela. Esto no es una verificación de evidencia -- solo nos ayuda a completar tu formulario.</p>
          <div className="space-y-2">
            {acquiredFields.map(key => {
              const f = data.structuredProfile[key];
              const isIdentity = (IDENTITY_FIELDS as readonly string[]).includes(key);
              const isReopened = reopenedFields.has(key);
              const isLocked = f.status === "beneficiary_confirmed" && !isReopened;
              return (
                <div key={key} className={`rounded-lg border px-3 py-2 ${f.status === "conflicting" ? "border-amber-300 bg-amber-50" : f.status === "beneficiary_confirmed" ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">{FIELD_LABELS[key] ?? key}{isIdentity ? "" : " (revisar antes de continuar)"}</span>
                    {f.status === "conflicting" && <span className="text-[10px] font-bold uppercase text-amber-600">Conflicto</span>}
                  </div>
                  <input
                    type="text" value={f.value ?? ""} disabled={isLocked}
                    onChange={e => onChange({ ...data, structuredProfile: { ...data.structuredProfile, [key]: { ...f, value: e.target.value } } })}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  {isLocked ? (
                    <button type="button" onClick={() => setReopenedFields(prev => new Set(prev).add(key))}
                      className="mt-1 text-xs font-medium text-gray-500 hover:text-brand-blue hover:underline">
                      Editar
                    </button>
                  ) : (
                    <button type="button" onClick={() => {
                        confirmProfileField(key, f.value ?? undefined);
                        setReopenedFields(prev => { const n = new Set(prev); n.delete(key); return n; });
                      }}
                      className="mt-1 text-xs font-medium text-brand-blue hover:underline">
                      Confirmar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
