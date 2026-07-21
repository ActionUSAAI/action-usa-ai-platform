"use client";

import { useState } from "react";
import { Loader2, Download, ChevronRight, RefreshCw, AlertCircle, Scale } from "lucide-react";

export interface RecommendationLetter {
  id: string;
  case_id: string;
  motor: "testimonial" | "institutional" | null;
  letter_type: string | null;
  criterion_covered: string;
  recommender_name: string;
  docx_path: string | null;
  status: string;
  created_at: string;
}

export interface PetitionDraft {
  id: string;
  case_id: string;
  petition_type: "standard" | "consultation_exception";
  visa_type: string;
  petition_strategy: "multiCriteria" | "singleAchievement" | null;
  docx_path: string | null;
  status: string;
  created_at: string;
}

export interface I129Draft {
  id: string;
  case_id: string;
  docx_path: string;
  is_complete: boolean;
  notes: string | null;
  created_at: string;
}

interface A3A4PanelProps {
  caseId: string;
  submissionId: string | null;
  initialLetters: RecommendationLetter[];
  initialDrafts: PetitionDraft[];
  initialI129Drafts: I129Draft[];
  userRole: string;
}

const ALLOWED_ROLES = new Set(["admin", "supervisor", "agent"]);

async function handleDownload(docxPath: string | null) {
  if (!docxPath) return;
  try {
    const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(docxPath)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    window.open(data.url, "_blank");
  } catch (e) {
    alert(`Error al generar enlace: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function A3A4Panel({ caseId, submissionId, initialLetters, initialDrafts, initialI129Drafts, userRole }: A3A4PanelProps) {
  const [letters, setLetters] = useState<RecommendationLetter[]>(initialLetters);
  const [drafts, setDrafts] = useState<PetitionDraft[]>(initialDrafts);
  const [i129Drafts, setI129Drafts] = useState<I129Draft[]>(initialI129Drafts);

  const [loadingTestimonial, setLoadingTestimonial] = useState(false);
  const [loadingInstitutional, setLoadingInstitutional] = useState(false);
  const [loadingAttorney, setLoadingAttorney] = useState(false);

  const [errorTestimonial, setErrorTestimonial] = useState<string | null>(null);
  const [errorInstitutional, setErrorInstitutional] = useState<string | null>(null);
  const [errorAttorney, setErrorAttorney] = useState<string | null>(null);

  const [attorneyName, setAttorneyName] = useState("");
  const [firmName, setFirmName] = useState("ACTION USA AI LLC");
  const [firmAddress, setFirmAddress] = useState("");
  const [petitionStrategy, setPetitionStrategy] = useState<"multiCriteria" | "singleAchievement">("multiCriteria");

  const [loadingI129, setLoadingI129] = useState(false);
  const [errorI129, setErrorI129] = useState<string | null>(null);

  if (!ALLOWED_ROLES.has(userRole)) return null;

  async function refreshLetters() {
    const refreshed = await fetch(`/api/case-letters?case_id=${caseId}`).then(r => r.json()).catch(() => null);
    if (refreshed?.letters) setLetters(refreshed.letters);
  }

  async function refreshDrafts() {
    const refreshed = await fetch(`/api/case-petitions?case_id=${caseId}`).then(r => r.json()).catch(() => null);
    if (refreshed?.drafts) setDrafts(refreshed.drafts);
  }

  async function refreshI129Drafts() {
    const refreshed = await fetch(`/api/case-i129-drafts?case_id=${caseId}`).then(r => r.json()).catch(() => null);
    if (refreshed?.drafts) setI129Drafts(refreshed.drafts);
  }

  async function runTestimonial() {
    setLoadingTestimonial(true);
    setErrorTestimonial(null);
    try {
      const res = await fetch("/api/agents/a3-testimonial-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorTestimonial(data.error ?? "Error al generar cartas testimoniales");
      } else {
        await refreshLetters();
      }
    } catch {
      setErrorTestimonial("Error de red al conectar con el Motor Testimonial");
    } finally {
      setLoadingTestimonial(false);
    }
  }

  async function runInstitutional() {
    setLoadingInstitutional(true);
    setErrorInstitutional(null);
    try {
      const res = await fetch("/api/agents/a3-institutional-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorInstitutional(data.error ?? "Error al generar cartas institucionales");
      } else {
        await refreshLetters();
      }
    } catch {
      setErrorInstitutional("Error de red al conectar con el Motor Institucional");
    } finally {
      setLoadingInstitutional(false);
    }
  }

  async function runAttorney() {
    if (!attorneyName || !firmName || !firmAddress) {
      setErrorAttorney("Completa nombre del abogado, bufete y dirección antes de generar.");
      return;
    }
    setLoadingAttorney(true);
    setErrorAttorney(null);
    try {
      const res = await fetch("/api/agents/a4-attorney-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, attorneyName, firmName, firmAddress, petitionStrategy }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorAttorney(data.error ?? "Error al generar la petición");
      } else {
        await refreshDrafts();
      }
    } catch {
      setErrorAttorney("Error de red al conectar con el Motor Abogado");
    } finally {
      setLoadingAttorney(false);
    }
  }

  async function runI129Form() {
    setLoadingI129(true);
    setErrorI129(null);
    try {
      const res = await fetch("/api/agents/a4-i129-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorI129(data.error ?? "Error al generar el Formulario I-129");
      } else {
        await refreshI129Drafts();
      }
    } catch {
      setErrorI129("Error de red al conectar con el generador de I-129");
    } finally {
      setLoadingI129(false);
    }
  }

  const testimonialLetters = letters.filter(l => l.motor === "testimonial");
  const institutionalLetters = letters.filter(l => l.motor === "institutional");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-6">
      <h3 className="text-sm font-semibold text-gray-900">Generación de Cartas y Petición</h3>

      {/* Testimonial */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">Motor Testimonial</h4>
          <button
            onClick={runTestimonial}
            disabled={loadingTestimonial || !submissionId}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#1B2B5E] text-white disabled:opacity-40"
          >
            {loadingTestimonial ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
            {testimonialLetters.length > 0 ? "Regenerar" : "Generar cartas"}
          </button>
        </div>
        {loadingTestimonial && <p className="text-xs text-gray-400">Generando… puede tardar 20-40 segundos.</p>}
        {errorTestimonial && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {errorTestimonial}
          </div>
        )}
        {testimonialLetters.map(l => (
          <div key={l.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-700">{l.recommender_name} — {l.criterion_covered}</span>
            <button onClick={() => handleDownload(l.docx_path)} className="flex items-center gap-1 text-[#1B2B5E]">
              <Download size={12} /> Descargar
            </button>
          </div>
        ))}
      </div>

      {/* Institucional */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">Motor Institucional</h4>
          <button
            onClick={runInstitutional}
            disabled={loadingInstitutional || !submissionId}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#1B2B5E] text-white disabled:opacity-40"
          >
            {loadingInstitutional ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
            {institutionalLetters.length > 0 ? "Regenerar" : "Generar cartas"}
          </button>
        </div>
        {loadingInstitutional && <p className="text-xs text-gray-400">Generando… puede tardar 20-40 segundos.</p>}
        {errorInstitutional && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {errorInstitutional}
          </div>
        )}
        {institutionalLetters.map(l => (
          <div key={l.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-700">{l.recommender_name} — {l.criterion_covered}</span>
            <button onClick={() => handleDownload(l.docx_path)} className="flex items-center gap-1 text-[#1B2B5E]">
              <Download size={12} /> Descargar
            </button>
          </div>
        ))}
      </div>

      {/* Abogado */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1.5"><Scale size={14} /> Motor Abogado — Petición</h4>
        <div className="grid grid-cols-2 gap-2">
          <input value={attorneyName} onChange={e => setAttorneyName(e.target.value)} placeholder="Nombre del abogado" className="text-xs border border-gray-200 rounded px-2 py-1.5" />
          <input value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Nombre del bufete" className="text-xs border border-gray-200 rounded px-2 py-1.5" />
          <input value={firmAddress} onChange={e => setFirmAddress(e.target.value)} placeholder="Dirección del bufete" className="text-xs border border-gray-200 rounded px-2 py-1.5 col-span-2" />
          <select value={petitionStrategy} onChange={e => setPetitionStrategy(e.target.value as "multiCriteria" | "singleAchievement")} className="text-xs border border-gray-200 rounded px-2 py-1.5 col-span-2">
            <option value="multiCriteria">Multi-criterio</option>
            <option value="singleAchievement">Logro único</option>
          </select>
        </div>
        <button
          onClick={runAttorney}
          disabled={loadingAttorney || !submissionId}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#1B2B5E] text-white disabled:opacity-40"
        >
          {loadingAttorney ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {drafts.length > 0 ? "Regenerar petición" : "Generar petición"}
        </button>
        {loadingAttorney && <p className="text-xs text-gray-400">Ensamblando Exhibits y generando petición… puede tardar 40-60 segundos.</p>}
        {errorAttorney && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {errorAttorney}
          </div>
        )}
        {drafts.map(d => (
          <div key={d.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-700">{d.petition_type === "standard" ? "Attorney Petition Letter (Tipo 0)" : "Consultation Exception Letter (Tipo 0b)"}</span>
            <button onClick={() => handleDownload(d.docx_path)} className="flex items-center gap-1 text-[#1B2B5E]">
              <Download size={12} /> Descargar
            </button>
          </div>
        ))}
      </div>

      {/* I-129 */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">Formulario I-129</h4>
          <button
            onClick={runI129Form}
            disabled={loadingI129 || !submissionId}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#1B2B5E] text-white disabled:opacity-40"
          >
            {loadingI129 ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
            {i129Drafts.length > 0 ? "Regenerar" : "Generar I-129"}
          </button>
        </div>
        <p className="text-xs text-amber-600">
          ⚠️ Mapeo parcial (Part 1 + nombre del beneficiario). No es un formulario completo listo para radicar.
        </p>
        {loadingI129 && <p className="text-xs text-gray-400">Generando… puede tardar 15-30 segundos.</p>}
        {errorI129 && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {errorI129}
          </div>
        )}
        {i129Drafts.map(d => (
          <div key={d.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-700">
              I-129 — {new Date(d.created_at).toLocaleDateString()} {d.is_complete ? "" : "(parcial)"}
            </span>
            <button onClick={() => handleDownload(d.docx_path)} className="flex items-center gap-1 text-[#1B2B5E]">
              <Download size={12} /> Descargar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
