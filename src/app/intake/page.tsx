"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Employment = {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  website: string;
  refName: string;
  refTitle: string;
  refEmail: string;
};

type Award = { id: string; name: string; org: string; year: string; description: string };
type Membership = { id: string; org: string; type: string; yearJoined: string; criteria: string };
type MediaItem = { id: string; publication: string; title: string; url: string; date: string };
type Article = { id: string; title: string; publication: string; date: string; url: string };
type Book = { id: string; title: string; publisher: string; year: string };
type Reference = { id: string; name: string; title: string; company: string; relationship: string; email: string };
type Degree = { id: string; degree: string; institution: string; year: string; specialty: string };

type FormData = {
  // Step 1
  fullName: string;
  email: string;
  whatsapp: string;
  nationality: string;
  profession: string;
  yearsExperience: string;
  usaObjective: string;
  // Step 2
  employment: Employment[];
  // Step 3
  hasAwards: boolean | null;
  awards: Award[];
  awardsDisposition: string;
  // Step 4
  hasMemberships: boolean | null;
  memberships: Membership[];
  membershipsDisposition: string;
  // Step 5
  hasMediaCoverage: boolean | null;
  mediaCoverage: MediaItem[];
  mediaDisposition: string;
  // Step 6
  hasArticles: boolean | null;
  articles: Article[];
  articlesDisposition: string;
  hasBooks: boolean | null;
  books: Book[];
  booksDisposition: string;
  // Step 7
  references: Reference[];
  // Step 8
  distinguishedCompany: string;
  distinguishedRole: string;
  whyDistinguished: string;
  whyRoleCritical: string;
  // Step 9
  bestPeriodStart: string;
  bestPeriodEnd: string;
  annualIncome: string;
  currency: string;
  usaIncomeGoal: string;
  // Step 10
  hasLeadingRole: boolean | null;
  leadingRoleDescription: string;
  hasCommercialSuccess: boolean | null;
  commercialSuccessDescription: string;
  hasJudgedOthers: boolean | null;
  judgedOthersDescription: string;
  hasExhibitions: boolean | null;
  exhibitionsDescription: string;
  academicDegrees: Degree[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2, 9);
}

const emptyEmployment = (): Employment => ({
  id: genId(), company: "", position: "", startDate: "", endDate: "",
  isCurrent: false, website: "", refName: "", refTitle: "", refEmail: "",
});
const emptyAward = (): Award => ({ id: genId(), name: "", org: "", year: "", description: "" });
const emptyMembership = (): Membership => ({ id: genId(), org: "", type: "", yearJoined: "", criteria: "" });
const emptyMedia = (): MediaItem => ({ id: genId(), publication: "", title: "", url: "", date: "" });
const emptyArticle = (): Article => ({ id: genId(), title: "", publication: "", date: "", url: "" });
const emptyBook = (): Book => ({ id: genId(), title: "", publisher: "", year: "" });
const emptyReference = (): Reference => ({ id: genId(), name: "", title: "", company: "", relationship: "", email: "" });
const emptyDegree = (): Degree => ({ id: genId(), degree: "", institution: "", year: "", specialty: "" });

const INITIAL: FormData = {
  fullName: "", email: "", whatsapp: "", nationality: "", profession: "",
  yearsExperience: "", usaObjective: "",
  employment: [emptyEmployment()],
  hasAwards: null, awards: [], awardsDisposition: "",
  hasMemberships: null, memberships: [], membershipsDisposition: "",
  hasMediaCoverage: null, mediaCoverage: [], mediaDisposition: "",
  hasArticles: null, articles: [], articlesDisposition: "",
  hasBooks: null, books: [], booksDisposition: "",
  references: [emptyReference()],
  distinguishedCompany: "", distinguishedRole: "", whyDistinguished: "", whyRoleCritical: "",
  bestPeriodStart: "", bestPeriodEnd: "", annualIncome: "", currency: "USD", usaIncomeGoal: "",
  hasLeadingRole: null, leadingRoleDescription: "",
  hasCommercialSuccess: null, commercialSuccessDescription: "",
  hasJudgedOthers: null, judgedOthersDescription: "",
  hasExhibitions: null, exhibitionsDescription: "",
  academicDegrees: [emptyDegree()],
};

const STEPS = [
  { title: "Datos Personales", subtitle: "Cuéntanos sobre ti para comenzar tu evaluación." },
  { title: "Historial Profesional", subtitle: "Lista tus empleos más importantes de mayor a menor antigüedad." },
  { title: "Premios y Distinciones", subtitle: "Reconocimientos nacionales o internacionales en tu campo." },
  { title: "Membresías por Mérito", subtitle: "Organizaciones que requieren logros sobresalientes para ingresar." },
  { title: "Cobertura en Medios", subtitle: "Artículos, entrevistas o reportajes sobre ti y tu trabajo." },
  { title: "Artículos y Libros", subtitle: "Publicaciones técnicas, académicas o literarias de tu autoría." },
  { title: "Referencias Profesionales", subtitle: "Colegas en posiciones altas que pueden respaldar tu trayectoria." },
  { title: "Empleador Más Distinguido", subtitle: "La empresa más reconocida donde has trabajado y tu rol crítico." },
  { title: "Información Económica", subtitle: "Tu historial de ingresos y metas financieras en Estados Unidos." },
  { title: "Criterios de Visa", subtitle: "Evaluación de los criterios O-1B y EB-1B que aplican a tu perfil." },
];

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} />{error}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
    />
  );
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
    >
      {children}
    </select>
  );
}

function YesNo({ value, onChange, yesLabel = "Sí tengo", noLabel = "No tengo" }: {
  value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
          value === true
            ? "border-brand-blue bg-brand-blue text-white shadow-sm"
            : "border-gray-200 text-gray-600 hover:border-brand-blue/50"
        }`}
      >
        ✓ {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
          value === false
            ? "border-brand-red bg-brand-red text-white shadow-sm"
            : "border-gray-200 text-gray-600 hover:border-brand-red/50"
        }`}
      >
        ✗ {noLabel}
      </button>
    </div>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border-2 border-dashed border-brand-blue/40 px-4 py-2.5 text-sm font-medium text-brand-blue hover:border-brand-blue hover:bg-brand-blue/5 transition-colors"
    >
      <Plus size={16} /> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-brand-red transition-colors"
      title="Eliminar"
    >
      <Trash2 size={16} />
    </button>
  );
}

function DispositionBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-medium text-amber-800">
        Sin {label} actualmente — describe tu estrategia o plan para esta categoría:
      </p>
      <Textarea
        value={value}
        onChange={onChange}
        placeholder={`Ej: Estoy en proceso de obtener ${label.toLowerCase()}, actualmente negociando con...`}
        rows={3}
      />
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────
function Step1({ d, u, err }: { d: FormData; u: (f: keyof FormData, v: string) => void; err: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Nombre completo" required error={err.fullName}>
          <Input value={d.fullName} onChange={(v) => u("fullName", v)} placeholder="Juan Carlos Rodríguez" />
        </Field>
        <Field label="Correo electrónico" required error={err.email}>
          <Input type="email" value={d.email} onChange={(v) => u("email", v)} placeholder="juan@ejemplo.com" />
        </Field>
        <Field label="WhatsApp (con código de país)" required error={err.whatsapp}>
          <Input value={d.whatsapp} onChange={(v) => u("whatsapp", v)} placeholder="+57 300 123 4567" />
        </Field>
        <Field label="Nacionalidad" required error={err.nationality}>
          <Input value={d.nationality} onChange={(v) => u("nationality", v)} placeholder="Colombiana" />
        </Field>
        <Field label="Profesión o campo de actividad" required error={err.profession}>
          <Input value={d.profession} onChange={(v) => u("profession", v)} placeholder="Director de Cine, Cirujano, Software Engineer..." />
        </Field>
        <Field label="Años de experiencia" required error={err.yearsExperience}>
          <Input type="number" value={d.yearsExperience} onChange={(v) => u("yearsExperience", v)} placeholder="10" />
        </Field>
      </div>
      <Field label="Objetivo en Estados Unidos" required error={err.usaObjective}
        hint="¿Qué deseas hacer en EE.UU.? ¿Trabajar, emprender, investigar, enseñar?">
        <Textarea
          value={d.usaObjective}
          onChange={(v) => u("usaObjective", v)}
          placeholder="Deseo establecerme en Los Ángeles para desarrollar proyectos cinematográficos con productoras norteamericanas..."
          rows={3}
        />
      </Field>
    </div>
  );
}

function Step2({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const add = () => setD((p) => ({ ...p, employment: [...p.employment, emptyEmployment()] }));
  const remove = (i: number) => setD((p) => ({ ...p, employment: p.employment.filter((_, idx) => idx !== i) }));
  const upd = (i: number, f: keyof Employment, v: string | boolean) =>
    setD((p) => {
      const emp = [...p.employment];
      emp[i] = { ...emp[i], [f]: v };
      return { ...p, employment: emp };
    });

  return (
    <div className="space-y-4">
      {d.employment.map((e, i) => (
        <div key={e.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-10">
          <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">
            Empleo {i + 1}
          </div>
          {d.employment.length > 1 && <RemoveBtn onClick={() => remove(i)} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <Input value={e.company} onChange={(v) => upd(i, "company", v)} placeholder="Netflix, Mayo Clinic, MIT..." />
            </Field>
            <Field label="Cargo / Posición">
              <Input value={e.position} onChange={(v) => upd(i, "position", v)} placeholder="Director de Fotografía, Jefe de Cirugía..." />
            </Field>
            <Field label="Fecha de inicio">
              <Input type="month" value={e.startDate} onChange={(v) => upd(i, "startDate", v)} />
            </Field>
            <Field label="Fecha de fin">
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={e.endDate}
                  onChange={(v) => upd(i, "endDate", v)}
                  disabled={e.isCurrent}
                />
                <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
                  <input
                    type="checkbox"
                    checked={e.isCurrent}
                    onChange={(ev) => upd(i, "isCurrent", ev.target.checked)}
                    className="accent-brand-blue"
                  />
                  Actual
                </label>
              </div>
            </Field>
            <Field label="Sitio web de la empresa" hint="Opcional">
              <Input value={e.website} onChange={(v) => upd(i, "website", v)} placeholder="https://empresa.com" />
            </Field>
          </div>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Referencia que firmará la carta de recomendación
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Nombre de la referencia">
                <Input value={e.refName} onChange={(v) => upd(i, "refName", v)} placeholder="María López" />
              </Field>
              <Field label="Cargo de la referencia">
                <Input value={e.refTitle} onChange={(v) => upd(i, "refTitle", v)} placeholder="VP of Engineering, Dean..." />
              </Field>
              <Field label="Email de la referencia">
                <Input type="email" value={e.refEmail} onChange={(v) => upd(i, "refEmail", v)} placeholder="mlopez@empresa.com" />
              </Field>
            </div>
          </div>
        </div>
      ))}
      <AddBtn label="Agregar otro empleo" onClick={add} />
    </div>
  );
}

function Step3({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const set = (f: keyof FormData, v: unknown) => setD((p) => ({ ...p, [f]: v }));
  const add = () => setD((p) => ({ ...p, awards: [...p.awards, emptyAward()] }));
  const remove = (i: number) => setD((p) => ({ ...p, awards: p.awards.filter((_, idx) => idx !== i) }));
  const upd = (i: number, f: keyof Award, v: string) =>
    setD((p) => { const a = [...p.awards]; a[i] = { ...a[i], [f]: v }; return { ...p, awards: a }; });

  return (
    <div className="space-y-5">
      <Field label="¿Has recibido premios, distinciones o reconocimientos en tu campo?" required>
        <YesNo value={d.hasAwards} onChange={(v) => set("hasAwards", v)} yesLabel="Sí, tengo premios" noLabel="No tengo aún" />
      </Field>
      {d.hasAwards === true && (
        <div className="space-y-3">
          {d.awards.map((a, i) => (
            <div key={a.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
              <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Premio {i + 1}</div>
              {d.awards.length > 0 && <RemoveBtn onClick={() => remove(i)} />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre del premio o reconocimiento">
                  <Input value={a.name} onChange={(v) => upd(i, "name", v)} placeholder="Oscar, Grammy, Premio Nacional de Ciencias..." />
                </Field>
                <Field label="Organización que lo otorgó">
                  <Input value={a.org} onChange={(v) => upd(i, "org", v)} placeholder="Academy of Motion Picture Arts..." />
                </Field>
                <Field label="Año">
                  <Input type="number" value={a.year} onChange={(v) => upd(i, "year", v)} placeholder="2022" />
                </Field>
                <Field label="Descripción breve">
                  <Input value={a.description} onChange={(v) => upd(i, "description", v)} placeholder="Premio al mejor documental latinoamericano..." />
                </Field>
              </div>
            </div>
          ))}
          <AddBtn label="Agregar premio" onClick={add} />
        </div>
      )}
      {d.hasAwards === false && (
        <DispositionBox value={d.awardsDisposition} onChange={(v) => set("awardsDisposition", v)} label="premios" />
      )}
    </div>
  );
}

function Step4({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const set = (f: keyof FormData, v: unknown) => setD((p) => ({ ...p, [f]: v }));
  const add = () => setD((p) => ({ ...p, memberships: [...p.memberships, emptyMembership()] }));
  const remove = (i: number) => setD((p) => ({ ...p, memberships: p.memberships.filter((_, idx) => idx !== i) }));
  const upd = (i: number, f: keyof Membership, v: string) =>
    setD((p) => { const m = [...p.memberships]; m[i] = { ...m[i], [f]: v }; return { ...p, memberships: m }; });

  return (
    <div className="space-y-5">
      <Field label="¿Perteneces a organizaciones o asociaciones que requieren logros extraordinarios para ser admitido?" required>
        <YesNo value={d.hasMemberships} onChange={(v) => set("hasMemberships", v)} yesLabel="Sí, soy miembro" noLabel="No pertenezco" />
      </Field>
      {d.hasMemberships === true && (
        <div className="space-y-3">
          {d.memberships.map((m, i) => (
            <div key={m.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
              <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Membresía {i + 1}</div>
              {d.memberships.length > 0 && <RemoveBtn onClick={() => remove(i)} />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre de la organización">
                  <Input value={m.org} onChange={(v) => upd(i, "org", v)} placeholder="Academy of Sciences, Directors Guild..." />
                </Field>
                <Field label="Tipo de membresía">
                  <Input value={m.type} onChange={(v) => upd(i, "type", v)} placeholder="Miembro titular, Fellow, Académico..." />
                </Field>
                <Field label="Año de ingreso">
                  <Input type="number" value={m.yearJoined} onChange={(v) => upd(i, "yearJoined", v)} placeholder="2019" />
                </Field>
                <Field label="Criterios de admisión requeridos">
                  <Input value={m.criteria} onChange={(v) => upd(i, "criteria", v)} placeholder="Mínimo 10 años de trayectoria, obras publicadas..." />
                </Field>
              </div>
            </div>
          ))}
          <AddBtn label="Agregar membresía" onClick={add} />
        </div>
      )}
      {d.hasMemberships === false && (
        <DispositionBox value={d.membershipsDisposition} onChange={(v) => set("membershipsDisposition", v)} label="membresías por mérito" />
      )}
    </div>
  );
}

function Step5({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const set = (f: keyof FormData, v: unknown) => setD((p) => ({ ...p, [f]: v }));
  const add = () => setD((p) => ({ ...p, mediaCoverage: [...p.mediaCoverage, emptyMedia()] }));
  const remove = (i: number) => setD((p) => ({ ...p, mediaCoverage: p.mediaCoverage.filter((_, idx) => idx !== i) }));
  const upd = (i: number, f: keyof MediaItem, v: string) =>
    setD((p) => { const mc = [...p.mediaCoverage]; mc[i] = { ...mc[i], [f]: v }; return { ...p, mediaCoverage: mc }; });

  return (
    <div className="space-y-5">
      <Field label="¿Han publicado artículos, entrevistas o reportajes sobre ti y tu trabajo?" required>
        <YesNo value={d.hasMediaCoverage} onChange={(v) => set("hasMediaCoverage", v)} yesLabel="Sí, hay cobertura" noLabel="No hay aún" />
      </Field>
      {d.hasMediaCoverage === true && (
        <div className="space-y-3">
          {d.mediaCoverage.map((m, i) => (
            <div key={m.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
              <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Cobertura {i + 1}</div>
              {d.mediaCoverage.length > 0 && <RemoveBtn onClick={() => remove(i)} />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Publicación o medio">
                  <Input value={m.publication} onChange={(v) => upd(i, "publication", v)} placeholder="The New York Times, Variety, El País..." />
                </Field>
                <Field label="Título del artículo">
                  <Input value={m.title} onChange={(v) => upd(i, "title", v)} placeholder="El director que revolucionó el cine latinoamericano..." />
                </Field>
                <Field label="Fecha de publicación">
                  <Input type="date" value={m.date} onChange={(v) => upd(i, "date", v)} />
                </Field>
                <Field label="URL del artículo" hint="Opcional">
                  <Input value={m.url} onChange={(v) => upd(i, "url", v)} placeholder="https://nytimes.com/2023/..." />
                </Field>
              </div>
            </div>
          ))}
          <AddBtn label="Agregar cobertura" onClick={add} />
        </div>
      )}
      {d.hasMediaCoverage === false && (
        <DispositionBox value={d.mediaDisposition} onChange={(v) => set("mediaDisposition", v)} label="cobertura en medios" />
      )}
    </div>
  );
}

function Step6({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const set = (f: keyof FormData, v: unknown) => setD((p) => ({ ...p, [f]: v }));
  const addArt = () => setD((p) => ({ ...p, articles: [...p.articles, emptyArticle()] }));
  const removeArt = (i: number) => setD((p) => ({ ...p, articles: p.articles.filter((_, idx) => idx !== i) }));
  const updArt = (i: number, f: keyof Article, v: string) =>
    setD((p) => { const a = [...p.articles]; a[i] = { ...a[i], [f]: v }; return { ...p, articles: a }; });

  const addBook = () => setD((p) => ({ ...p, books: [...p.books, emptyBook()] }));
  const removeBook = (i: number) => setD((p) => ({ ...p, books: p.books.filter((_, idx) => idx !== i) }));
  const updBook = (i: number, f: keyof Book, v: string) =>
    setD((p) => { const b = [...p.books]; b[i] = { ...b[i], [f]: v }; return { ...p, books: b }; });

  return (
    <div className="space-y-6">
      {/* Articles */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">Artículos publicados</h3>
        <Field label="¿Has publicado artículos académicos, técnicos o especializados?" required>
          <YesNo value={d.hasArticles} onChange={(v) => set("hasArticles", v)} yesLabel="Sí, tengo artículos" noLabel="No tengo aún" />
        </Field>
        {d.hasArticles === true && (
          <div className="space-y-3">
            {d.articles.map((a, i) => (
              <div key={a.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
                <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Artículo {i + 1}</div>
                {d.articles.length > 0 && <RemoveBtn onClick={() => removeArt(i)} />}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Título del artículo">
                    <Input value={a.title} onChange={(v) => updArt(i, "title", v)} placeholder="Machine Learning in Radiology..." />
                  </Field>
                  <Field label="Revista o publicación">
                    <Input value={a.publication} onChange={(v) => updArt(i, "publication", v)} placeholder="Nature, The Lancet, IEEE..." />
                  </Field>
                  <Field label="Fecha">
                    <Input type="month" value={a.date} onChange={(v) => updArt(i, "date", v)} />
                  </Field>
                  <Field label="URL" hint="Opcional">
                    <Input value={a.url} onChange={(v) => updArt(i, "url", v)} placeholder="https://doi.org/..." />
                  </Field>
                </div>
              </div>
            ))}
            <AddBtn label="Agregar artículo" onClick={addArt} />
          </div>
        )}
        {d.hasArticles === false && (
          <DispositionBox value={d.articlesDisposition} onChange={(v) => set("articlesDisposition", v)} label="artículos publicados" />
        )}
      </div>

      <div className="border-t border-gray-200" />

      {/* Books */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">Libros publicados</h3>
        <Field label="¿Has publicado libros?" required>
          <YesNo value={d.hasBooks} onChange={(v) => set("hasBooks", v)} yesLabel="Sí, tengo libros" noLabel="No tengo aún" />
        </Field>
        {d.hasBooks === true && (
          <div className="space-y-3">
            {d.books.map((b, i) => (
              <div key={b.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
                <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Libro {i + 1}</div>
                {d.books.length > 0 && <RemoveBtn onClick={() => removeBook(i)} />}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Título del libro">
                    <Input value={b.title} onChange={(v) => updBook(i, "title", v)} placeholder="Inteligencia Artificial Aplicada..." />
                  </Field>
                  <Field label="Editorial">
                    <Input value={b.publisher} onChange={(v) => updBook(i, "publisher", v)} placeholder="Penguin, MIT Press, Planeta..." />
                  </Field>
                  <Field label="Año">
                    <Input type="number" value={b.year} onChange={(v) => updBook(i, "year", v)} placeholder="2021" />
                  </Field>
                </div>
              </div>
            ))}
            <AddBtn label="Agregar libro" onClick={addBook} />
          </div>
        )}
        {d.hasBooks === false && (
          <DispositionBox value={d.booksDisposition} onChange={(v) => set("booksDisposition", v)} label="libros publicados" />
        )}
      </div>
    </div>
  );
}

function Step7({ d, setD }: { d: FormData; setD: (fn: (prev: FormData) => FormData) => void }) {
  const add = () => setD((p) => ({ ...p, references: [...p.references, emptyReference()] }));
  const remove = (i: number) => setD((p) => ({ ...p, references: p.references.filter((_, idx) => idx !== i) }));
  const upd = (i: number, f: keyof Reference, v: string) =>
    setD((p) => { const r = [...p.references]; r[i] = { ...r[i], [f]: v }; return { ...p, references: r }; });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Estas referencias deben ser personas con cargos altos (directores, decanos, presidentes, jefes de departamento) que conozcan tu trabajo y estén dispuestas a escribir cartas de recomendación.
      </div>
      {d.references.map((r, i) => (
        <div key={r.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
          <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Referencia {i + 1}</div>
          {d.references.length > 1 && <RemoveBtn onClick={() => remove(i)} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre completo">
              <Input value={r.name} onChange={(v) => upd(i, "name", v)} placeholder="Dr. Robert Chen" />
            </Field>
            <Field label="Cargo / Título">
              <Input value={r.title} onChange={(v) => upd(i, "title", v)} placeholder="Dean of Medicine, CTO, Festival Director..." />
            </Field>
            <Field label="Empresa / Institución">
              <Input value={r.company} onChange={(v) => upd(i, "company", v)} placeholder="Harvard Medical School, Pixar, Sony Music..." />
            </Field>
            <Field label="Relación profesional">
              <Input value={r.relationship} onChange={(v) => upd(i, "relationship", v)} placeholder="Supervisor directo, colaborador en proyecto, mentor..." />
            </Field>
            <Field label="Email" hint="Opcional — para contacto futuro">
              <Input type="email" value={r.email} onChange={(v) => upd(i, "email", v)} placeholder="rchen@harvard.edu" />
            </Field>
          </div>
        </div>
      ))}
      <AddBtn label="Agregar referencia" onClick={add} />
    </div>
  );
}

function Step8({ d, u }: { d: FormData; u: (f: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Empresa o institución más distinguida donde trabajaste" required>
          <Input value={d.distinguishedCompany} onChange={(v) => u("distinguishedCompany", v)} placeholder="Netflix, NASA, Cirque du Soleil, Johns Hopkins..." />
        </Field>
        <Field label="Tu cargo en esa empresa" required>
          <Input value={d.distinguishedRole} onChange={(v) => u("distinguishedRole", v)} placeholder="Head of Animation, Lead Surgeon, Principal Scientist..." />
        </Field>
      </div>
      <Field label="¿Por qué esa empresa es considerada distinguida en tu campo?" required>
        <Textarea
          value={d.whyDistinguished}
          onChange={(v) => u("whyDistinguished", v)}
          placeholder="Netflix es la plataforma de streaming más grande del mundo con 260 millones de suscriptores, reconocida por producir contenido de alta calidad y ganar múltiples premios Emmy y Oscar..."
          rows={4}
        />
      </Field>
      <Field label="¿Por qué tu rol fue crítico o indispensable para esa organización?" required>
        <Textarea
          value={d.whyRoleCritical}
          onChange={(v) => u("whyRoleCritical", v)}
          placeholder="Fui el único experto en síntesis de proteínas en el equipo de 200 científicos, y mis investigaciones resultaron en 3 patentes que generaron $50M en licencias. Sin mi participación, el proyecto habría tomado 5 años adicionales..."
          rows={4}
        />
      </Field>
    </div>
  );
}

function Step9({ d, u }: { d: FormData; u: (f: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Esta información es confidencial y solo se usa para evaluar tu elegibilidad. Los ingresos demuestran que has recibido remuneración alta en relación a tus pares.
      </div>
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Mejor período de ingresos <span className="text-brand-red">*</span></p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Desde">
            <Input type="month" value={d.bestPeriodStart} onChange={(v) => u("bestPeriodStart", v)} />
          </Field>
          <Field label="Hasta">
            <Input type="month" value={d.bestPeriodEnd} onChange={(v) => u("bestPeriodEnd", v)} />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Ingreso anual en ese período" required hint="Ingreso bruto promedio por año">
          <div className="flex gap-2">
            <Select value={d.currency} onChange={(v) => u("currency", v)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="COP">COP</option>
              <option value="MXN">MXN</option>
              <option value="ARS">ARS</option>
              <option value="BRL">BRL</option>
              <option value="PEN">PEN</option>
              <option value="CLP">CLP</option>
              <option value="VES">VES</option>
              <option value="Otro">Otro</option>
            </Select>
            <Input value={d.annualIncome} onChange={(v) => u("annualIncome", v)} placeholder="120,000" />
          </div>
        </Field>
        <Field label="Meta de ingreso anual en EE.UU." required>
          <div className="flex gap-2">
            <span className="flex h-10 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">USD</span>
            <Input value={d.usaIncomeGoal} onChange={(v) => u("usaIncomeGoal", v)} placeholder="200,000" />
          </div>
        </Field>
      </div>
    </div>
  );
}

function Step10({ d, setD, u }: {
  d: FormData;
  setD: (fn: (prev: FormData) => FormData) => void;
  u: (f: keyof FormData, v: string) => void;
}) {
  const set = (f: keyof FormData, v: unknown) => setD((p) => ({ ...p, [f]: v }));
  const addDeg = () => setD((p) => ({ ...p, academicDegrees: [...p.academicDegrees, emptyDegree()] }));
  const removeDeg = (i: number) => setD((p) => ({ ...p, academicDegrees: p.academicDegrees.filter((_, idx) => idx !== i) }));
  const updDeg = (i: number, f: keyof Degree, v: string) =>
    setD((p) => { const deg = [...p.academicDegrees]; deg[i] = { ...deg[i], [f]: v }; return { ...p, academicDegrees: deg }; });

  const criteria = [
    {
      key: "hasLeadingRole" as keyof FormData,
      descKey: "leadingRoleDescription" as keyof FormData,
      label: "Rol protagónico o de liderazgo",
      hint: "¿Has tenido un papel principal, estelar, o de liderazgo crítico en producciones, proyectos u organizaciones distinguidas?",
    },
    {
      key: "hasCommercialSuccess" as keyof FormData,
      descKey: "commercialSuccessDescription" as keyof FormData,
      label: "Éxito comercial de alta trayectoria",
      hint: "¿Tus obras, servicios o proyectos han logrado alto éxito comercial, de audiencia o de impacto? (ventas, visualizaciones, patentes, contratos de alto valor...)",
    },
    {
      key: "hasJudgedOthers" as keyof FormData,
      descKey: "judgedOthersDescription" as keyof FormData,
      label: "Juzgar o evaluar el trabajo de otros",
      hint: "¿Has actuado como jurado en festivales, concursos, comités editoriales, revisiones por pares, o procesos de selección en tu campo?",
    },
    {
      key: "hasExhibitions" as keyof FormData,
      descKey: "exhibitionsDescription" as keyof FormData,
      label: "Presentaciones, exhibiciones o actuaciones",
      hint: "¿Tu trabajo ha sido presentado, exhibido o actuado en escenarios de relevancia nacional o internacional?",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 text-sm text-brand-blue">
        Estas preguntas evalúan cuántos criterios de las visas O-1B y EB-1B cumples. Responde con honestidad — no necesitas cumplir todos.
      </div>

      {criteria.map((c) => (
        <div key={c.key as string} className="space-y-3 rounded-xl border border-gray-200 p-4">
          <div>
            <p className="font-semibold text-gray-800">{c.label}</p>
            <p className="mt-0.5 text-sm text-gray-500">{c.hint}</p>
          </div>
          <YesNo
            value={d[c.key] as boolean | null}
            onChange={(v) => set(c.key, v)}
            yesLabel="Sí aplica"
            noLabel="No aplica"
          />
          {d[c.key] === true && (
            <Textarea
              value={(d[c.descKey] as string) || ""}
              onChange={(v) => u(c.descKey, v)}
              placeholder="Describe específicamente cómo aplica este criterio a tu caso..."
              rows={3}
            />
          )}
        </div>
      ))}

      <div className="space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Perfil académico</p>
          <p className="mt-0.5 text-sm text-gray-500">Títulos universitarios, posgrados, doctorados, especializaciones.</p>
        </div>
        {d.academicDegrees.map((deg, i) => (
          <div key={deg.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-8">
            <div className="absolute left-4 top-3 text-xs font-bold text-brand-blue uppercase tracking-wider">Título {i + 1}</div>
            {d.academicDegrees.length > 1 && <RemoveBtn onClick={() => removeDeg(i)} />}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Título obtenido">
                <Input value={deg.degree} onChange={(v) => updDeg(i, "degree", v)} placeholder="Doctorado, Maestría, Licenciatura..." />
              </Field>
              <Field label="Institución">
                <Input value={deg.institution} onChange={(v) => updDeg(i, "institution", v)} placeholder="Universidad de Harvard, UNAM, Universidad de Chile..." />
              </Field>
              <Field label="Año de graduación">
                <Input type="number" value={deg.year} onChange={(v) => updDeg(i, "year", v)} placeholder="2015" />
              </Field>
              <Field label="Especialidad / Campo">
                <Input value={deg.specialty} onChange={(v) => updDeg(i, "specialty", v)} placeholder="Neurociencias, Cinematografía, Inteligencia Artificial..." />
              </Field>
            </div>
          </div>
        ))}
        <AddBtn label="Agregar título académico" onClick={addDeg} />
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ caseNumber, email }: { caseNumber: string; email: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-16 w-auto" priority />
        </div>
        <div className="rounded-2xl bg-white shadow-2xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle size={48} className="text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">¡Evaluación enviada!</h1>
            <p className="mt-2 text-gray-600">Tu solicitud fue recibida y está siendo procesada.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-500">Número de caso asignado</p>
            <p className="text-2xl font-bold text-brand-blue tracking-wider">{caseNumber}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 text-left space-y-2">
            <p className="font-semibold">Próximos pasos:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Recibirás un email en <strong>{email}</strong> con el enlace para crear tu cuenta en el portal.</li>
              <li>Un especialista revisará tu evaluación y te contactará en 1-3 días hábiles.</li>
              <li>En el portal podrás hacer seguimiento a tu caso, subir documentos y comunicarte con tu equipo.</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            ¿Preguntas? Escríbenos a{" "}
            <a href="mailto:actionusaaillc@gmail.com" className="text-brand-blue hover:underline font-medium">
              actionusaaillc@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntakePage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ caseNumber: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof FormData, value: string) =>
    setData((p) => ({ ...p, [field]: value }));

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (step === 1) {
      if (!data.fullName.trim()) e.fullName = "El nombre es requerido.";
      if (!data.email.trim()) e.email = "El email es requerido.";
      else if (!/\S+@\S+\.\S+/.test(data.email)) e.email = "Email inválido.";
      if (!data.whatsapp.trim()) e.whatsapp = "El WhatsApp es requerido.";
      if (!data.nationality.trim()) e.nationality = "La nacionalidad es requerida.";
      if (!data.profession.trim()) e.profession = "La profesión es requerida.";
      if (!data.yearsExperience.trim()) e.yearsExperience = "Los años de experiencia son requeridos.";
      if (!data.usaObjective.trim()) e.usaObjective = "El objetivo en EE.UU. es requerido.";
    }
    if (step === 2) {
      if (data.employment.length === 0 || !data.employment[0].company.trim())
        e.employment = "Agrega al menos un empleo.";
    }
    if (step === 3 && data.hasAwards === null) e.hasAwards = "Selecciona una opción.";
    if (step === 4 && data.hasMemberships === null) e.hasMemberships = "Selecciona una opción.";
    if (step === 5 && data.hasMediaCoverage === null) e.hasMediaCoverage = "Selecciona una opción.";
    if (step === 6) {
      if (data.hasArticles === null) e.hasArticles = "Selecciona una opción.";
      if (data.hasBooks === null) e.hasBooks = "Selecciona una opción.";
    }
    if (step === 8) {
      if (!data.distinguishedCompany.trim()) e.distinguishedCompany = "Requerido.";
      if (!data.distinguishedRole.trim()) e.distinguishedRole = "Requerido.";
      if (!data.whyDistinguished.trim()) e.whyDistinguished = "Requerido.";
      if (!data.whyRoleCritical.trim()) e.whyRoleCritical = "Requerido.";
    }
    if (step === 9) {
      if (!data.bestPeriodStart) e.bestPeriodStart = "Requerido.";
      if (!data.bestPeriodEnd) e.bestPeriodEnd = "Requerido.";
      if (!data.annualIncome.trim()) e.annualIncome = "Requerido.";
      if (!data.usaIncomeGoal.trim()) e.usaIncomeGoal = "Requerido.";
    }
    if (step === 10) {
      if (data.hasLeadingRole === null) e.hasLeadingRole = "Selecciona.";
      if (data.hasCommercialSuccess === null) e.hasCommercialSuccess = "Selecciona.";
      if (data.hasJudgedOthers === null) e.hasJudgedOthers = "Selecciona.";
      if (data.hasExhibitions === null) e.hasExhibitions = "Selecciona.";
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    return true;
  }

  function next() {
    if (validate()) {
      setStep((s) => Math.min(s + 1, 10));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al enviar");
      setSuccess({ caseNumber: json.caseNumber });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error desconocido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) return <SuccessScreen caseNumber={success.caseNumber} email={data.email} />;

  const stepMeta = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark py-8 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Logo & subtitle */}
        <div className="mb-6 text-center">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-14 w-auto" priority />
          <p className="mt-2 text-sm text-blue-200">Evaluación de Talento Extraordinario — O-1B / EB-1B</p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-full bg-brand-red transition-all duration-500 ease-out"
              style={{ width: `${(step / 10) * 100}%` }}
            />
          </div>

          {/* Step header */}
          <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
                  Paso {step} de 10
                </span>
                <h2 className="mt-0.5 text-xl font-bold text-brand-blue">{stepMeta.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{stepMeta.subtitle}</p>
              </div>
              {/* Step dots */}
              <div className="mt-1 flex shrink-0 flex-wrap justify-end gap-1.5 max-w-[140px]">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i + 1 < step ? "bg-brand-red" : i + 1 === step ? "bg-brand-blue" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Validation error banner */}
          {Object.keys(errors).length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 px-6 py-3 text-sm text-red-700 sm:px-8">
              <AlertCircle size={16} className="shrink-0" />
              Por favor completa los campos requeridos antes de continuar.
            </div>
          )}

          {/* Form content */}
          <div className="px-6 py-6 sm:px-8">
            {step === 1 && <Step1 d={data} u={update} err={errors} />}
            {step === 2 && <Step2 d={data} setD={setData} />}
            {step === 3 && <Step3 d={data} setD={setData} />}
            {step === 4 && <Step4 d={data} setD={setData} />}
            {step === 5 && <Step5 d={data} setD={setData} />}
            {step === 6 && <Step6 d={data} setD={setData} />}
            {step === 7 && <Step7 d={data} setD={setData} />}
            {step === 8 && <Step8 d={data} u={update} />}
            {step === 9 && <Step9 d={data} u={update} />}
            {step === 10 && <Step10 d={data} setD={setData} u={update} />}
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 px-6 py-3 text-sm text-red-700 sm:px-8">
              <AlertCircle size={16} className="shrink-0" />
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <span className="hidden text-xs text-gray-400 sm:block">
              {Math.round((step / 10) * 100)}% completado
            </span>

            {step < 10 ? (
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60 transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>Enviar Evaluación <ChevronRight size={16} /></>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-blue-300">
          Tu información es confidencial y está protegida por nuestras políticas de privacidad.
        </p>
      </div>
    </div>
  );
}
