import { useState, useEffect } from "react";
import type { Module15, O2Companion } from "../types";
import { Field, TextInput, Textarea, YesNo, AddBtn, Card, FileUpload, InfoBox, SectionDivider } from "../primitives";

type Props = { data: Module15; onChange: (d: Module15) => void; sessionId: string; profession: string; industry: string; visaType: string };

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyCompanion = (): O2Companion => ({
  id: genId(), fullName: "", nationality: "", role: "", whyEssential: "",
  relationshipDuration: "", passportPath: "", passportName: "",
  employmentEvidencePath: "", employmentEvidenceName: "",
});

const PEER_OPTIONS = [
  {
    value: "si" as const,
    label: "Sí, conozco una asociación aplicable",
    sub: "Existe una asociación profesional o sindicato reconocido en mi campo.",
    color: "border-green-500 bg-green-50",
    labelColor: "text-green-800",
  },
  {
    value: "no" as const,
    label: "No existe una asociación para mi profesión",
    sub: "No hay grupo de pares reconocido que aplique a mi especialidad.",
    color: "border-gray-400 bg-gray-50",
    labelColor: "text-gray-700",
  },
  {
    value: "no_se" as const,
    label: "No estoy seguro/a",
    sub: "No sé si existe una asociación de pares aplicable a mi caso.",
    color: "border-amber-400 bg-amber-50",
    labelColor: "text-amber-800",
  },
];

export function Module15({ data: d, onChange, sessionId, profession, industry, visaType }: Props) {
  const set = <K extends keyof Module15>(k: K, v: Module15[K]) => onChange({ ...d, [k]: v });

  const [suggestions, setSuggestions] = useState<{ id: string; organization_name: string; category: string }[]>([]);

  useEffect(() => {
    if (d.hasPeerGroup !== "si") return;
    if (!profession && !industry) return;
    const params = new URLSearchParams({ profession, industry, visaType });
    fetch(`/api/peer-group-search?${params}`)
      .then((r) => r.json())
      .then((j) => setSuggestions(j.suggestions ?? []))
      .catch(() => setSuggestions([]));
  }, [d.hasPeerGroup, profession, industry, visaType]);

  const updComp = <K extends keyof O2Companion>(i: number, f: K, v: O2Companion[K]) => {
    const arr = [...d.companions];
    arr[i] = { ...arr[i], [f]: v };
    onChange({ ...d, companions: arr });
  };

  return (
    <div className="space-y-8">

      {/* ══ SECTION A — Consultative Opinion ════════════════════════════════ */}
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-bold text-[#1B2B5E]">Sección A — Opinión Consultiva</h3>
          <p className="mt-1 text-sm text-gray-500">
            USCIS requiere una opinión de un grupo de expertos de su campo profesional antes de aprobar
            su petición. Esta sección nos ayuda a identificar la fuente más adecuada para su caso.
          </p>
        </div>

        {/* Peer group selector */}
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-700">
            ¿Existe una asociación profesional o sindicato reconocido en su campo? <span className="text-red-500">*</span>
          </p>
          <div className="grid gap-3">
            {PEER_OPTIONS.map(({ value, label, sub, color, labelColor }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("hasPeerGroup", value)}
                className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                  d.hasPeerGroup === value ? color : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                  d.hasPeerGroup === value ? "border-current" : "border-gray-300"
                }`}>
                  {d.hasPeerGroup === value && (
                    <span className="h-2 w-2 rounded-full bg-current block" />
                  )}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${d.hasPeerGroup === value ? labelColor : "text-gray-700"}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* If yes — peer group exists */}
        {d.hasPeerGroup === "si" && (
          <div className="space-y-4 rounded-xl border border-green-200 bg-green-50/30 p-4">
            {suggestions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-600">Sugerencias basadas en tu profesión:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set("peerGroupName", s.organization_name)}
                      className="rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
                    >
                      {s.organization_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Nombre de la asociación o grupo de pares" required>
              <TextInput value={d.peerGroupName} onChange={v => set("peerGroupName", v)}
                placeholder="Screen Actors Guild (SAG-AFTRA), IEEE, ASCAP..." />
            </Field>

            <Field label="Dirección física de la organización" required>
              <TextInput value={d.peerGroupStreetAddress} onChange={v => set("peerGroupStreetAddress", v)}
                placeholder="1900 Broadway, New York, NY" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Ciudad" required>
                <TextInput value={d.peerGroupCity} onChange={v => set("peerGroupCity", v)} placeholder="New York"/>
              </Field>
              <Field label="Estado" required>
                <TextInput value={d.peerGroupState} onChange={v => set("peerGroupState", v)} placeholder="NY"/>
              </Field>
              <Field label="ZIP" required>
                <TextInput value={d.peerGroupZipCode} onChange={v => set("peerGroupZipCode", v)} placeholder="10023"/>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de envío de la consulta">
                <TextInput type="date" value={d.peerGroupDateSent} onChange={v => set("peerGroupDateSent", v)} />
              </Field>
              <Field label="Teléfono diurno de contacto">
                <TextInput value={d.peerGroupPhone} onChange={v => set("peerGroupPhone", v)} placeholder="(212) 555-0100"/>
              </Field>
            </div>

            <Field label="Tipo de carta esperada de la asociación">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "opinion_favorable", label: "Opinión favorable", sub: "La asociación apoya la petición" },
                  { value: "no_objecion",       label: "Carta de no objeción", sub: "La asociación no objeta la petición" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("peerGroupLetterType", opt.value as Module15["peerGroupLetterType"])}
                    className={`flex flex-col gap-0.5 rounded-lg border-2 p-3 text-left transition-all ${
                      d.peerGroupLetterType === opt.value
                        ? "border-[#1B2B5E] bg-[#1B2B5E]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-medium ${d.peerGroupLetterType === opt.value ? "text-[#1B2B5E]" : "text-gray-700"}`}>
                      {opt.label}
                    </span>
                    <span className="text-xs text-gray-500">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </Field>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">¿Ya tiene la carta? Puede subirla aquí</p>
              <FileUpload sessionId={sessionId} storagePath="consultative/letter"
                filePath={d.peerGroupLetterPath} fileName={d.peerGroupLetterName}
                onChange={({ filePath, fileName }) => onChange({ ...d, peerGroupLetterPath: filePath, peerGroupLetterName: fileName })} />
              <p className="mt-1.5 text-xs text-gray-400">
                Si aún no la tiene, nuestro equipo le orientará sobre cómo solicitarla.
              </p>
            </div>
          </div>
        )}

        {/* If no or unsure — alternative contact */}
        {(d.hasPeerGroup === "no" || d.hasPeerGroup === "no_se") && (
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <InfoBox variant="amber">
              Si no existe una asociación formal, USCIS acepta una carta de un experto reconocido del campo.
              Indíquenos quién podría emitir dicha carta.
            </InfoBox>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de persona o entidad alternativa">
                <TextInput value={d.alternativeContactName} onChange={v => set("alternativeContactName", v)}
                  placeholder="Dr. Ricardo Torres, Instituto de Biotecnología..." />
              </Field>
              <Field label="Organización a la que pertenece">
                <TextInput value={d.alternativeContactOrg} onChange={v => set("alternativeContactOrg", v)}
                  placeholder="MIT, Academia Española de Medicina..." />
              </Field>
              <Field label="Relación con su campo profesional">
                <TextInput value={d.alternativeContactRelation} onChange={v => set("alternativeContactRelation", v)}
                  placeholder="Experto en biotecnología agrícola, líder del gremio..." />
              </Field>
            </div>
            {d.hasPeerGroup === "no" && (
              <Field label="Justificación de ausencia de asociación aplicable">
                <Textarea value={d.noAssociationJustification} onChange={v => set("noAssociationJustification", v)}
                  placeholder="Explique brevemente por qué no existe una asociación de pares para su profesión o especialidad..."
                  rows={3} />
              </Field>
            )}
          </div>
        )}

        {/* Notes for team */}
        {d.hasPeerGroup !== "" && (
          <Field label="Notas adicionales para el equipo" hint="Opcional">
            <Textarea value={d.consultativeNotes} onChange={v => set("consultativeNotes", v)}
              placeholder="Cualquier información adicional relevante sobre la opinión consultiva o el grupo de pares..."
              rows={2} />
          </Field>
        )}
      </div>

      <hr className="border-gray-100" />

      {/* ══ SECTION B — O-2 Companions ══════════════════════════════════════ */}
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-bold text-[#1B2B5E]">Sección B — Acompañantes O-2</h3>
          <p className="mt-1 text-sm text-gray-500">
            Si su actividad en Estados Unidos requiere personal de apoyo esencial que deba ingresar con usted,
            puede incluirlos aquí como acompañantes O-2. Esto aplica a asistentes técnicos, co-intérpretes u
            otros colaboradores indispensables con quienes tenga una relación laboral preexistente.
          </p>
        </div>

        <Field label="¿Requiere acompañantes O-2 para realizar su actividad en EE.UU.?">
          <YesNo value={d.hasO2Companions} onChange={v => set("hasO2Companions", v)}
            yesLabel="Sí, necesito acompañantes O-2" noLabel="No, trabajaré solo/a" />
        </Field>

        {d.hasO2Companions === true && (
          <div className="space-y-4">
            {d.companions.map((c, i) => (
              <Card key={c.id} label="Acompañante O-2" index={i}
                onRemove={d.companions.length > 1 ? () => onChange({ ...d, companions: d.companions.filter((_, idx) => idx !== i) }) : undefined}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre completo" required>
                    <TextInput value={c.fullName} onChange={v => updComp(i, "fullName", v)}
                      placeholder="María González" />
                  </Field>
                  <Field label="Nacionalidad" required>
                    <TextInput value={c.nationality} onChange={v => updComp(i, "nationality", v)}
                      placeholder="Colombiana, Mexicana..." />
                  </Field>
                  <Field label="Función o rol específico" required>
                    <TextInput value={c.role} onChange={v => updComp(i, "role", v)}
                      placeholder="Asistente técnico, co-entrenador, coordinador..." />
                  </Field>
                  <Field label="¿Desde cuándo trabajan juntos?" required>
                    <TextInput value={c.relationshipDuration} onChange={v => updComp(i, "relationshipDuration", v)}
                      placeholder="5 años, desde 2019..." />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="¿Por qué es esencial para su actividad?" required>
                    <Textarea value={c.whyEssential} onChange={v => updComp(i, "whyEssential", v)}
                      placeholder="Explique por qué este colaborador es indispensable y no puede ser reemplazado por un trabajador estadounidense..."
                      rows={3} />
                  </Field>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">Pasaporte</p>
                    <FileUpload sessionId={sessionId} storagePath={`companions/${c.id}/passport`}
                      filePath={c.passportPath} fileName={c.passportName}
                      onChange={({ filePath, fileName }) => {
                        const arr = [...d.companions];
                        arr[i] = { ...arr[i], passportPath: filePath, passportName: fileName };
                        onChange({ ...d, companions: arr });
                      }} />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">Evidencia de relación laboral</p>
                    <p className="mb-1.5 text-xs text-gray-400">Contratos previos, cartas de empleador, nóminas, etc.</p>
                    <FileUpload sessionId={sessionId} storagePath={`companions/${c.id}/employment`}
                      filePath={c.employmentEvidencePath} fileName={c.employmentEvidenceName}
                      onChange={({ filePath, fileName }) => {
                        const arr = [...d.companions];
                        arr[i] = { ...arr[i], employmentEvidencePath: filePath, employmentEvidenceName: fileName };
                        onChange({ ...d, companions: arr });
                      }} />
                  </div>
                </div>
              </Card>
            ))}
            <AddBtn label="Agregar acompañante O-2"
              onClick={() => onChange({ ...d, companions: [...d.companions, emptyCompanion()] })} />
          </div>
        )}
      </div>
    </div>
  );
}
