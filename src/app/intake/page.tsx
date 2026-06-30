"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, CheckCircle, Save } from "lucide-react";

import type { IntakeForm, ModuleStatus } from "./types";
import { Module1 }  from "./modules/Module1";
import { Module2 }  from "./modules/Module2";
import { Module4 }  from "./modules/Module4";
import { Module5 }  from "./modules/Module5";
import { Module6 }  from "./modules/Module6";
import { Module7 }  from "./modules/Module7";
import { Module8 }  from "./modules/Module8";
import { Module9 }  from "./modules/Module9";
import { Module10 } from "./modules/Module10";
import { Module11 } from "./modules/Module11";
import { Module12 } from "./modules/Module12";
import { Module13 } from "./modules/Module13";

const STORAGE_KEY    = "aucis_intake_draft";
const SESSION_ID_KEY = "aucis_session_id";
const TOTAL = 12;

// Step → module mapping (Module3 absorbed into Module2)
// 1=Module1  2=Module2  3=Module4  4=Module5  5=Module6  6=Module7
// 7=Module8  8=Module9  9=Module10 10=Module11 11=Module12 12=Module13

const MODULE_TITLES = [
  { title: "Identidad del Aplicante",     subtitle: "Información básica para comenzar tu evaluación." },
  { title: "Documentos y Grupo Familiar", subtitle: "Documentos migratorios, estado civil e información de hijos." },
  { title: "Historial Migratorio",        subtitle: "Visitas, visas y antecedentes migratorios en USA." },
  { title: "Educación Formal",            subtitle: "Títulos universitarios y posgrados." },
  { title: "Cursos y Certificaciones",    subtitle: "Cursos, licencias y certificaciones profesionales." },
  { title: "Experiencia Profesional",     subtitle: "Tu historial laboral en detalle. Esta es la sección más importante." },
  { title: "Empresas Propias",            subtitle: "Emprendimientos o empresas que hayas fundado." },
  { title: "Referencias Profesionales",   subtitle: "Personas que pueden confirmar tu impacto." },
  { title: "Evidencia Existente",         subtitle: "Premios, publicaciones, medios y otros logros documentados." },
  { title: "Información Estratégica",     subtitle: "Preguntas abiertas para entender mejor tu trayectoria." },
  { title: "Servicios Estratégicos",      subtitle: "Opciones para fortalecer tu caso si hay áreas pendientes." },
  { title: "Resumen y Envío",             subtitle: "Revisa tu progreso y envía tu información a ACTION USA." },
];

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyDoc = () => ({
  has: null as boolean | null,
  notes: "",
  documentNumber: "",
  expiryDate: "",
  issuedDate: "",
  issuedCountry: "",
  issuedCity: "",
  visaSubtype: "",
  filePath: "",
  fileName: "",
});

const emptyAnswer = () => ({ answer: "", hasEvidence: null as boolean | null, filePath: "", fileName: "" });

const INITIAL: IntakeForm = {
  module1: {
    fullName:"", dateOfBirth:"", countryOfBirth:"", nationalities:"",
    countryOfResidence:"", cityOfResidence:"", email:"", whatsapp:"",
    profession:"", industry:"", yearsExperience:"", usaObjective:"", visaType:"",
  },
  module2: {
    passport:emptyDoc(), usVisa:emptyDoc(), i94:emptyDoc(), i797:emptyDoc(),
    ead:emptyDoc(), i20:emptyDoc(), ds2019:emptyDoc(),
    maritalStatus:"",
    spouse:{ name:"", nationality:"", countryOfResidence:"", profession:"" },
    spouseMarriageCert:emptyDoc(), spousePassport:emptyDoc(),
    spouseVisa:emptyDoc(), spouseI94:emptyDoc(),
    hasChildren:null, childrenDocs:[],
  },
  module4: {
    hasBeenInUSA:null, usaVisits:[],
    hasVisaRejection:null, visaRejections:[],
    hasDeportation:null, deportationDescription:"",
  },
  module5: {
    degrees:[{ id:genId(), institution:"", country:"", degreeType:"", degreeName:"", startYear:"", graduationYear:"", hasDiploma:"", filePath:"", fileName:"" }],
  },
  module6: { certifications:[] },
  module7: {
    employment:[{
      id:genId(), company:"", country:"", city:"", title:"",
      startDate:"", endDate:"", isCurrent:false,
      mainFunctions:"", importantProjects:"", mainAchievements:"",
      peopleSupervised:"0", managesBudget:null, budgetAmount:"",
      whyImportant:"", supervisorName:"", supervisorTitle:"",
      supervisorEmail:"", supervisorPhone:"", companyWebsite:"", internationalRecognition:"",
    }],
  },
  module8:  { hasOwnBusinesses:null, businesses:[] },
  module9:  { references:[{ id:genId(), name:"", currentTitle:"", company:"", country:"", email:"", phone:"", howYouKnow:"", whatTheyCouldSay:"", hasBeenAsked:null }] },
  module10: {
    awardsStatus:"", awards:[], awardsDisposition:"",
    membershipsStatus:"", memberships:[], membershipsDisposition:"",
    mediaStatus:"", media:[], mediaDisposition:"",
    articlesStatus:"", articles:[], articlesDisposition:"",
    booksStatus:"", books:[], booksDisposition:"",
    conferencesStatus:"", conferences:[], conferencesDisposition:"",
    judgingStatus:"", judging:[], judgingDisposition:"",
    patentsStatus:"", patents:[], patentsDisposition:"",
    incomeEvidence:{
      hasTaxReturns:null, taxFilePath:"", taxFileName:"",
      hasCertifications:null, certFilePath:"", certFileName:"",
      hasContracts:null, contractFilePath:"", contractFileName:"",
    },
    hasWebsite:null, websiteUrl:"", websiteTopicIdea:"",
  },
  module11: {
    createdMethod:emptyAnswer(), ledImpactProjects:emptyAnswer(), solvedComplexProblems:emptyAnswer(),
    trainedProfessionals:emptyAnswer(), consultedForExpertise:emptyAnswer(), evaluatedOthers:emptyAnswer(),
    workedForRecognized:emptyAnswer(), aboveAverageIncome:emptyAnswer(),
    willingToConfirm:emptyAnswer(), additionalInfo:emptyAnswer(),
  },
  module12: { interest:"" },
};

// n = step number (1-12, skipping old module3)
function getModuleStatus(n: number, f: IntakeForm): ModuleStatus {
  switch (n) {
    case 1: {
      const m = f.module1;
      const filled = [m.fullName, m.email, m.whatsapp, m.profession].filter(v => v.trim());
      if (filled.length === 4 && m.visaType) return "complete";
      if (filled.length > 0) return "partial";
      return "empty";
    }
    case 2: {
      const m = f.module2;
      const hasAnyDoc = [m.passport, m.usVisa, m.i94, m.i797, m.ead, m.i20, m.ds2019].some(d => d.has !== null);
      if (m.maritalStatus && m.hasChildren !== null && hasAnyDoc) return "complete";
      if (m.maritalStatus || m.hasChildren !== null || hasAnyDoc) return "partial";
      return "empty";
    }
    case 3: { // Module4 — immigration
      const m = f.module4;
      const answered = [m.hasBeenInUSA, m.hasVisaRejection, m.hasDeportation].filter(v => v !== null);
      if (answered.length === 3) return "complete";
      if (answered.length > 0) return "partial";
      return "empty";
    }
    case 4: { // Module5 — education
      const complete = f.module5.degrees.filter(d => d.institution && d.degreeName);
      if (complete.length > 0) return "complete";
      if (f.module5.degrees.some(d => d.institution || d.degreeName)) return "partial";
      return "empty";
    }
    case 5: // Module6 — certifications
      return f.module6.certifications.length > 0 ? "partial" : "empty";
    case 6: { // Module7 — work
      const good = f.module7.employment.filter(e => e.company && e.title && e.mainFunctions);
      if (good.length > 0) return "complete";
      if (f.module7.employment.some(e => e.company || e.title)) return "partial";
      return "empty";
    }
    case 7: // Module8 — businesses
      if (f.module8.hasOwnBusinesses !== null) return f.module8.hasOwnBusinesses ? "partial" : "complete";
      return "empty";
    case 8: { // Module9 — references
      const good = f.module9.references.filter(r => r.name && r.email);
      if (good.length >= 3) return "complete";
      if (good.length > 0) return "partial";
      return "empty";
    }
    case 9: { // Module10 — evidence
      const filled = [
        f.module10.awardsStatus, f.module10.membershipsStatus, f.module10.mediaStatus,
        f.module10.articlesStatus, f.module10.booksStatus, f.module10.conferencesStatus,
        f.module10.judgingStatus, f.module10.patentsStatus,
      ].filter(s => s !== "");
      if (filled.length >= 5) return "complete";
      if (filled.length > 0) return "partial";
      return "empty";
    }
    case 10: { // Module11 — strategic
      const answered = Object.values(f.module11).filter(v => (v as { answer: string }).answer.trim()).length;
      if (answered >= 7) return "complete";
      if (answered > 0) return "partial";
      return "empty";
    }
    case 11: // Module12 — optional services
      return f.module12.interest ? "complete" : "empty";
    default: return "empty";
  }
}

function shouldShowModule12(f: IntakeForm): boolean {
  const score = [
    f.module10.awardsStatus, f.module10.membershipsStatus, f.module10.mediaStatus,
    f.module10.articlesStatus, f.module10.booksStatus, f.module10.conferencesStatus,
    f.module10.judgingStatus, f.module10.patentsStatus,
  ].filter(s => s === "tengo").length;
  return score < 3;
}

function SuccessScreen({ caseNumber, email }: { caseNumber: string; email: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-16 w-auto" priority/>
        </div>
        <div className="rounded-2xl bg-white shadow-2xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle size={48} className="text-green-600"/>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">¡Evaluación enviada!</h1>
            <p className="mt-2 text-gray-600">Tu información fue recibida y está siendo procesada.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-500">Número de caso asignado</p>
            <p className="text-2xl font-bold text-brand-blue tracking-wider">{caseNumber}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 text-left space-y-2">
            <p className="font-semibold">Próximos pasos:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Recibirás un email en <strong>{email}</strong> con el enlace para crear tu cuenta.</li>
              <li>Un especialista revisará tu evaluación en 1-3 días hábiles.</li>
              <li>Desde el portal podrás completar módulos pendientes y subir documentos.</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            ¿Preguntas?{" "}
            <a href="mailto:actionusaaillc@gmail.com" className="text-brand-blue hover:underline font-medium">
              actionusaaillc@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function IntakePage() {
  const [step, setStep]           = useState(1);
  const [data, setData]           = useState<IntakeForm>(INITIAL);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess]     = useState<{ caseNumber: string } | null>(null);
  const [savedAt, setSavedAt]     = useState<Date | null>(null);
  const [draftBanner, setDraftBanner] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  // ── Init session ID and load draft ─────────────────────────────────────────
  useEffect(() => {
    try {
      let sid = localStorage.getItem(SESSION_ID_KEY);
      if (!sid) {
        sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem(SESSION_ID_KEY, sid);
      }
      setSessionId(sid);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<IntakeForm>;
        // Shallow-merge each module so new fields added after the draft was saved get their defaults.
        setData({
          ...INITIAL,
          ...saved,
          module2: { ...INITIAL.module2, ...(saved.module2 ?? {}) },
          module4: {
            ...INITIAL.module4,
            ...(({ hasBeenInUSA, usaVisits, hasVisaRejection, visaRejections, hasDeportation, deportationDescription }) =>
              ({ hasBeenInUSA, usaVisits, hasVisaRejection, visaRejections, hasDeportation, deportationDescription })
            )(saved.module4 ?? INITIAL.module4),
          },
          module10: { ...INITIAL.module10, ...(saved.module10 ?? {}), incomeEvidence: { ...INITIAL.module10.incomeEvidence, ...(saved.module10?.incomeEvidence ?? {}) } },
        });
        setDraftBanner(true);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Autosave every 30 seconds ──────────────────────────────────────────────
  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSavedAt(new Date());
    } catch { /* ignore */ }
  }, [data]);

  useEffect(() => {
    const id = setInterval(save, 30_000);
    return () => clearInterval(id);
  }, [save]);

  // statuses[i] covers steps 1–11 (step 12 = summary, no status dot needed)
  const statuses = Array.from({ length: 11 }, (_, i) => getModuleStatus(i + 1, data));
  const show12   = shouldShowModule12(data);

  function validate(): boolean {
    if (step !== 1) return true;
    const e: Record<string, string> = {};
    const m = data.module1;
    if (!m.fullName.trim())   e.fullName   = "Requerido.";
    if (!m.email.trim())      e.email      = "Requerido.";
    else if (!/\S+@\S+\.\S+/.test(m.email)) e.email = "Email inválido.";
    if (!m.whatsapp.trim())   e.whatsapp   = "Requerido.";
    if (!m.profession.trim()) e.profession = "Requerido.";
    setErrors(e);
    if (Object.keys(e).length > 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return false; }
    return true;
  }

  function next() {
    if (!validate()) return;
    // Step 10 = Module11 (strategic). If show12 is false, skip step 11 (Module12) → go to 12 (summary).
    const nextStep = step === 10 && !show12 ? 12 : step + 1;
    setStep(Math.min(nextStep, TOTAL));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    const prevStep = step === 12 && !show12 ? 10 : step - 1;
    setStep(Math.max(prevStep, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setLoading(true);
    setSubmitError(null);
    save();
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, moduleStatuses: statuses }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al enviar");
      localStorage.removeItem(STORAGE_KEY);
      setSuccess({ caseNumber: json.caseNumber });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error desconocido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) return <SuccessScreen caseNumber={success.caseNumber} email={data.module1.email}/>;

  const meta     = MODULE_TITLES[step - 1];
  const progress = Math.round((step / TOTAL) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark py-8 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Logo */}
        <div className="mb-5 text-center">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-12 w-auto" priority/>
          <p className="mt-1.5 text-xs text-blue-200">AUCIS — ACTION USA Case Intelligence System</p>
        </div>

        {/* Draft resume banner */}
        {draftBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white backdrop-blur">
            <span>📋 Encontramos un borrador guardado.</span>
            <div className="flex gap-2">
              <button onClick={() => setDraftBanner(false)}
                className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30 transition-colors">
                Retomar
              </button>
              <button onClick={() => { setData(INITIAL); setDraftBanner(false); localStorage.removeItem(STORAGE_KEY); }}
                className="rounded-lg bg-brand-red/80 px-3 py-1.5 text-xs font-medium hover:bg-brand-red transition-colors">
                Comenzar de nuevo
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div className="h-full bg-brand-red transition-all duration-500" style={{ width: `${progress}%` }}/>
          </div>

          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
                  Módulo {step} de {TOTAL}
                </span>
                <h2 className="mt-0.5 text-xl font-bold text-brand-blue">{meta.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{meta.subtitle}</p>
              </div>
              <div className="mt-1 flex shrink-0 flex-wrap justify-end gap-1 max-w-[130px]">
                {Array.from({ length: TOTAL }, (_, i) => {
                  const s = i < 11 ? statuses[i] : null;
                  return (
                    <div key={i}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i + 1 < step
                          ? s === "complete" ? "bg-green-500" : s === "partial" ? "bg-amber-400" : "bg-brand-red"
                          : i + 1 === step ? "bg-brand-blue" : "bg-gray-200"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Autosave indicator */}
          {savedAt && (
            <div className="flex items-center gap-1.5 bg-green-50 px-6 py-1.5 text-xs text-green-700">
              <Save size={11}/> Borrador guardado
            </div>
          )}

          {/* Module content — step 3+ maps to Module4+ (Module3 absorbed into Module2) */}
          <div className="px-6 py-6 sm:px-8">
            {step === 1  && <Module1  data={data.module1}  onChange={m => setData(p => ({ ...p, module1:  m }))} errors={errors}/>}
            {step === 2  && <Module2  data={data.module2}  onChange={m => setData(p => ({ ...p, module2:  m }))} sessionId={sessionId}/>}
            {step === 3  && <Module4  data={data.module4}  onChange={m => setData(p => ({ ...p, module4:  m }))}/>}
            {step === 4  && <Module5  data={data.module5}  onChange={m => setData(p => ({ ...p, module5:  m }))} sessionId={sessionId}/>}
            {step === 5  && <Module6  data={data.module6}  onChange={m => setData(p => ({ ...p, module6:  m }))} sessionId={sessionId}/>}
            {step === 6  && <Module7  data={data.module7}  onChange={m => setData(p => ({ ...p, module7:  m }))}/>}
            {step === 7  && <Module8  data={data.module8}  onChange={m => setData(p => ({ ...p, module8:  m }))}/>}
            {step === 8  && <Module9  data={data.module9}  onChange={m => setData(p => ({ ...p, module9:  m }))}/>}
            {step === 9  && <Module10 data={data.module10} onChange={m => setData(p => ({ ...p, module10: m }))} sessionId={sessionId}/>}
            {step === 10 && <Module11 data={data.module11} onChange={m => setData(p => ({ ...p, module11: m }))} sessionId={sessionId}/>}
            {step === 11 && <Module12 data={data.module12} onChange={m => setData(p => ({ ...p, module12: m }))}/>}
            {step === 12 && <Module13 statuses={statuses} show12={show12} loading={loading} error={submitError} onSubmit={submit}/>}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 sm:px-8">
            <button type="button" onClick={back} disabled={step === 1}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
              <ChevronLeft size={16}/> Anterior
            </button>

            <div className="hidden text-center sm:block">
              <p className="text-xs text-gray-400">{progress}% completado</p>
              <button type="button" onClick={save}
                className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-brand-blue transition-colors">
                <Save size={11}/> Guardar borrador
              </button>
            </div>

            {step < TOTAL && (
              <button type="button" onClick={next}
                className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm">
                Siguiente <ChevronRight size={16}/>
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-blue-300">
          Tu información es confidencial y está protegida por nuestras políticas de privacidad.
          Guardado automáticamente cada 30 segundos.
        </p>
      </div>
    </div>
  );
}
