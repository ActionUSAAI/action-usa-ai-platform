import { Building2, User, Briefcase } from "lucide-react";
import type { Module14, ItineraryItem } from "../types";
import { Field, TextInput, Textarea, Select, YesNo, AddBtn, Card, FileUpload, InfoBox, SectionDivider } from "../primitives";
import { composeFullName } from "../name-utils";
import { composeAddress } from "../address-utils";

type Props = { data: Module14; onChange: (d: Module14) => void; sessionId: string; visaType: string };

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyItem = (): ItineraryItem => ({
  id: genId(), eventDate: "", eventEndDate: "", eventName: "",
  venue: "", city: "", state: "", employerName: "",
});

const PETITIONER_TYPES = [
  {
    value: "empresa" as const,
    label: "Empresa estadounidense",
    sub: "LLC, Corp., sociedad u otra entidad legal registrada en EE.UU.",
    Icon: Building2,
  },
  {
    value: "persona_natural" as const,
    label: "Persona natural",
    sub: "Individuo que actúa como empleador o patrocinador directo.",
    Icon: User,
  },
  {
    value: "agente" as const,
    label: "Agente autorizado",
    sub: "Agente o agencia que actúa en nombre del empleador.",
    Icon: Briefcase,
  },
];

export function Module14({ data: d, onChange, sessionId, visaType }: Props) {
  const set = <K extends keyof Module14>(k: K, v: Module14[K]) => onChange({ ...d, [k]: v });

  function updateRepresentativeNameField(field: "representativeFamilyName" | "representativeGivenName" | "representativeMiddleName", value: string) {
    const updated = { ...d, [field]: value };
    const representativeName = composeFullName(updated.representativeFamilyName, updated.representativeGivenName, updated.representativeMiddleName);
    onChange({ ...updated, representativeName });
  }

  function updatePetitionerNameField(field: "petitionerFamilyName" | "petitionerGivenName" | "petitionerMiddleName", value: string) {
    const updated = { ...d, [field]: value };
    const petitionerFullName = composeFullName(updated.petitionerFamilyName, updated.petitionerGivenName, updated.petitionerMiddleName);
    onChange({ ...updated, petitionerFullName });
  }

  function updateCompanyAddressField(
    field: "companyStreetNumberName" | "companyAptSteFlr" | "companyAptSteFlrNumber" | "companyCity" | "companyState" | "companyZipCode",
    value: string
  ) {
    const updated = { ...d, [field]: value };
    const companyAddress = composeAddress(
      updated.companyStreetNumberName, updated.companyAptSteFlr, updated.companyAptSteFlrNumber,
      updated.companyCity, updated.companyState, updated.companyZipCode
    );
    onChange({ ...updated, companyAddress });
  }

  function updatePetitionerAddressField(
    field: "petitionerStreetNumberName" | "petitionerAptSteFlr" | "petitionerAptSteFlrNumber" | "petitionerCity" | "petitionerState" | "petitionerZipCode",
    value: string
  ) {
    const updated = { ...d, [field]: value };
    const petitionerAddress = composeAddress(
      updated.petitionerStreetNumberName, updated.petitionerAptSteFlr, updated.petitionerAptSteFlrNumber,
      updated.petitionerCity, updated.petitionerState, updated.petitionerZipCode
    );
    onChange({ ...updated, petitionerAddress });
  }

  const updItem = <K extends keyof ItineraryItem>(i: number, f: K, v: ItineraryItem[K]) => {
    const arr = [...d.itineraryItems];
    arr[i] = { ...arr[i], [f]: v };
    onChange({ ...d, itineraryItems: arr });
  };

  return (
    <div className="space-y-6">
      <InfoBox>
        El peticionario es quien presenta la petición de visa ante USCIS en su nombre.
        Esta información es necesaria para preparar el formulario I-129 correctamente.
      </InfoBox>

      {/* ── Petitioner type ───────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Tipo de peticionario <span className="text-red-500">*</span></p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PETITIONER_TYPES.map(({ value, label, sub, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("petitionerType", value)}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                d.petitionerType === value
                  ? "border-[#1B2B5E] bg-[#1B2B5E]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Icon size={20} className={d.petitionerType === value ? "text-[#1B2B5E]" : "text-gray-400"} />
              <span className={`text-sm font-semibold ${d.petitionerType === value ? "text-[#1B2B5E]" : "text-gray-700"}`}>
                {label}
              </span>
              <span className="text-xs text-gray-500 leading-snug">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Empresa section ───────────────────────────────────────────────── */}
      {d.petitionerType === "empresa" && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <SectionDivider title="Información de la empresa" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre legal de la empresa" required>
              <TextInput value={d.companyName} onChange={v => set("companyName", v)}
                placeholder="Acme Productions LLC" />
            </Field>
            <Field label="Número EIN" required hint="Formato: XX-XXXXXXX">
              <TextInput value={d.ein} onChange={v => set("ein", v)} placeholder="12-3456789" />
            </Field>
            <Field label="Estado de incorporación" required>
              <TextInput value={d.stateOfIncorporation} onChange={v => set("stateOfIncorporation", v)}
                placeholder="California, New York..." />
            </Field>
            <Field label="Apellido(s) del representante" required>
              <TextInput value={d.representativeFamilyName} onChange={v => updateRepresentativeNameField("representativeFamilyName", v)} placeholder="Smith"/>
            </Field>
            <Field label="Nombre(s) del representante" required>
              <TextInput value={d.representativeGivenName} onChange={v => updateRepresentativeNameField("representativeGivenName", v)} placeholder="Jane"/>
            </Field>
            <Field label="Segundo nombre">
              <TextInput value={d.representativeMiddleName} onChange={v => updateRepresentativeNameField("representativeMiddleName", v)} placeholder="(opcional)"/>
            </Field>
            <Field label="Nombre completo (generado automáticamente)">
              <TextInput value={d.representativeName} onChange={() => {}} disabled placeholder=""/>
            </Field>
            <Field label="Cargo del representante" required>
              <TextInput value={d.representativeTitle} onChange={v => set("representativeTitle", v)}
                placeholder="CEO, Directora de Operaciones..." />
            </Field>
          </div>
          <Field label="Número y nombre de calle" required>
            <TextInput value={d.companyStreetNumberName} onChange={v => updateCompanyAddressField("companyStreetNumberName", v)} placeholder="123 Main St"/>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Tipo">
              <Select value={d.companyAptSteFlr} onChange={v => updateCompanyAddressField("companyAptSteFlr", v as "APT" | "STE" | "FLR" | "")}>
                <option value="">—</option>
                <option value="APT">Apt</option>
                <option value="STE">Ste</option>
                <option value="FLR">Flr</option>
              </Select>
            </Field>
            <Field label="Número">
              <TextInput value={d.companyAptSteFlrNumber} onChange={v => updateCompanyAddressField("companyAptSteFlrNumber", v)} placeholder="400"/>
            </Field>
            <Field label="ZIP" required>
              <TextInput value={d.companyZipCode} onChange={v => updateCompanyAddressField("companyZipCode", v)} placeholder="90001"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ciudad" required>
              <TextInput value={d.companyCity} onChange={v => updateCompanyAddressField("companyCity", v)} placeholder="Los Angeles"/>
            </Field>
            <Field label="Estado" required>
              <TextInput value={d.companyState} onChange={v => updateCompanyAddressField("companyState", v)} placeholder="CA"/>
            </Field>
          </div>
          <Field label="Dirección completa (generada automáticamente)">
            <TextInput value={d.companyAddress} onChange={() => {}} disabled placeholder=""/>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Artículos de Incorporación</p>
              <FileUpload sessionId={sessionId} storagePath="petitioner/articles"
                filePath={d.companyArticlesPath} fileName={d.companyArticlesName}
                onChange={({ filePath, fileName }) => onChange({ ...d, companyArticlesPath: filePath, companyArticlesName: fileName })} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Documento EIN (carta IRS)</p>
              <FileUpload sessionId={sessionId} storagePath="petitioner/ein"
                filePath={d.einDocPath} fileName={d.einDocName}
                onChange={({ filePath, fileName }) => onChange({ ...d, einDocPath: filePath, einDocName: fileName })} />
            </div>
          </div>
        </div>
      )}

      {/* ── Persona natural section ───────────────────────────────────────── */}
      {d.petitionerType === "persona_natural" && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <SectionDivider title="Información del peticionario" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Apellido(s) del peticionario" required>
              <TextInput value={d.petitionerFamilyName} onChange={v => updatePetitionerNameField("petitionerFamilyName", v)} placeholder="Doe"/>
            </Field>
            <Field label="Nombre(s) del peticionario" required>
              <TextInput value={d.petitionerGivenName} onChange={v => updatePetitionerNameField("petitionerGivenName", v)} placeholder="John"/>
            </Field>
            <Field label="Segundo nombre">
              <TextInput value={d.petitionerMiddleName} onChange={v => updatePetitionerNameField("petitionerMiddleName", v)} placeholder="(opcional)"/>
            </Field>
            <Field label="Nombre completo (generado automáticamente)">
              <TextInput value={d.petitionerFullName} onChange={() => {}} disabled placeholder=""/>
            </Field>
            <Field label="Fecha de nacimiento" required>
              <TextInput type="date" value={d.petitionerDateOfBirth}
                onChange={v => set("petitionerDateOfBirth", v)} />
            </Field>
            <Field label="Relación con el beneficiario" required>
              <TextInput value={d.petitionerRelationship} onChange={v => set("petitionerRelationship", v)}
                placeholder="Empleador, dueño del rancho, cliente..." />
            </Field>
          </div>
          <Field label="Número y nombre de calle" required>
            <TextInput value={d.petitionerStreetNumberName} onChange={v => updatePetitionerAddressField("petitionerStreetNumberName", v)} placeholder="456 Oak Ave"/>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Tipo">
              <Select value={d.petitionerAptSteFlr} onChange={v => updatePetitionerAddressField("petitionerAptSteFlr", v as "APT" | "STE" | "FLR" | "")}>
                <option value="">—</option>
                <option value="APT">Apt</option>
                <option value="STE">Ste</option>
                <option value="FLR">Flr</option>
              </Select>
            </Field>
            <Field label="Número">
              <TextInput value={d.petitionerAptSteFlrNumber} onChange={v => updatePetitionerAddressField("petitionerAptSteFlrNumber", v)} placeholder="12"/>
            </Field>
            <Field label="ZIP" required>
              <TextInput value={d.petitionerZipCode} onChange={v => updatePetitionerAddressField("petitionerZipCode", v)} placeholder="75201"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ciudad" required>
              <TextInput value={d.petitionerCity} onChange={v => updatePetitionerAddressField("petitionerCity", v)} placeholder="Dallas"/>
            </Field>
            <Field label="Estado" required>
              <TextInput value={d.petitionerState} onChange={v => updatePetitionerAddressField("petitionerState", v)} placeholder="TX"/>
            </Field>
          </div>
          <Field label="Dirección completa (generada automáticamente)">
            <TextInput value={d.petitionerAddress} onChange={() => {}} disabled placeholder=""/>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                Identificación con foto vigente <span className="text-red-500">*</span>
              </p>
              <p className="mb-1.5 text-xs text-gray-400">Pasaporte o documento de identidad gubernamental</p>
              <FileUpload sessionId={sessionId} storagePath="petitioner/id"
                filePath={d.petitionerIdPath} fileName={d.petitionerIdName}
                onChange={({ filePath, fileName }) => onChange({ ...d, petitionerIdPath: filePath, petitionerIdName: fileName })} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                Acta de nacimiento <span className="text-red-500">*</span>
              </p>
              <FileUpload sessionId={sessionId} storagePath="petitioner/birthcert"
                filePath={d.petitionerBirthCertPath} fileName={d.petitionerBirthCertName}
                onChange={({ filePath, fileName }) => onChange({ ...d, petitionerBirthCertPath: filePath, petitionerBirthCertName: fileName })} />
            </div>
          </div>
        </div>
      )}

      {/* ── Agente section ────────────────────────────────────────────────── */}
      {d.petitionerType === "agente" && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <SectionDivider title="Información del agente" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del agente o agencia" required>
              <TextInput value={d.agentName} onChange={v => set("agentName", v)}
                placeholder="Creative Artists Agency" />
            </Field>
            <Field label="Nombre del empleador representado" required>
              <TextInput value={d.agentEmployerName} onChange={v => set("agentEmployerName", v)}
                placeholder="Madison Square Garden Sports Corp." />
            </Field>
          </div>
          <Field label="Tipo de acuerdo con el empleador" required>
            <TextInput value={d.agentAgreementType} onChange={v => set("agentAgreementType", v)}
              placeholder="Poder notarial, contrato de representación exclusiva..." />
          </Field>
        </div>
      )}

      {/* ── Common section (only after type is selected) ──────────────────── */}
      {d.petitionerType && (
        <>
          <SectionDivider title="Detalles del servicio" />

          <div className="space-y-4">
            <Field label="Naturaleza del negocio o actividad" required>
              <Textarea value={d.businessNature} onChange={v => set("businessNature", v)}
                placeholder="Describa brevemente la actividad principal del peticionario (producción musical, deporte profesional, investigación científica...)"
                rows={2} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cargo o posición ofrecida al beneficiario" required>
                <TextInput value={d.offeredPosition} onChange={v => set("offeredPosition", v)}
                  placeholder="Científico Principal, Jugador Profesional, Director Musical..." />
              </Field>
              <div className="col-span-1 sm:col-span-1" />
              <Field label="Fecha de inicio de servicios" required>
                <TextInput type="date" value={d.serviceStartDate} onChange={v => set("serviceStartDate", v)} />
              </Field>
              <Field label="Fecha de finalización de servicios" required>
                <TextInput type="date" value={d.serviceEndDate} onChange={v => set("serviceEndDate", v)} />
              </Field>
            </div>

            <Field label="¿Existe contrato escrito?">
              <YesNo value={d.hasWrittenContract} onChange={v => set("hasWrittenContract", v)}
                yesLabel="Sí, tengo contrato escrito" noLabel="No, acuerdo verbal" />
            </Field>

            {d.hasWrittenContract === true && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">Subir contrato</p>
                <FileUpload sessionId={sessionId} storagePath="petitioner/contract"
                  filePath={d.contractPath} fileName={d.contractName}
                  onChange={({ filePath, fileName }) => onChange({ ...d, contractPath: filePath, contractName: fileName })} />
              </div>
            )}

            {d.hasWrittenContract === false && (
              <Field label="Describa los términos del acuerdo verbal">
                <Textarea value={d.contractVerbalTerms} onChange={v => set("contractVerbalTerms", v)}
                  placeholder="Duración del acuerdo, compensación, responsabilidades pactadas, forma de pago..." rows={3} />
              </Field>
            )}
          </div>

          {/* ── Itinerary ─────────────────────────────────────────────────── */}
          <SectionDivider title="Itinerario de eventos" />

          <Field label="¿Tiene itinerario de eventos o actividades en EE.UU.?">
            <YesNo value={d.hasItinerary} onChange={v => set("hasItinerary", v)}
              yesLabel="Sí, tengo itinerario" noLabel="No por el momento" />
          </Field>

          {d.hasItinerary === true && (
            <div className="space-y-3">
              {d.itineraryItems.map((item, i) => (
                <Card key={item.id} label="Evento" index={i}
                  onRemove={d.itineraryItems.length > 1 ? () => onChange({ ...d, itineraryItems: d.itineraryItems.filter((_, idx) => idx !== i) }) : undefined}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Fecha de inicio">
                      <TextInput type="date" value={item.eventDate} onChange={v => updItem(i, "eventDate", v)} />
                    </Field>
                    <Field label="Fecha de finalización">
                      <TextInput type="date" value={item.eventEndDate} onChange={v => updItem(i, "eventEndDate", v)} />
                    </Field>
                    <Field label="Nombre del evento o actividad">
                      <TextInput value={item.eventName} onChange={v => updItem(i, "eventName", v)}
                        placeholder="Annual Tech Summit, Liga Nacional de Fútbol..." />
                    </Field>
                    <Field label="Nombre del lugar o venue">
                      <TextInput value={item.venue} onChange={v => updItem(i, "venue", v)}
                        placeholder="Madison Square Garden, Moscone Center..." />
                    </Field>
                    <Field label="Ciudad">
                      <TextInput value={item.city} onChange={v => updItem(i, "city", v)} placeholder="New York" />
                    </Field>
                    <Field label="Estado">
                      <TextInput value={item.state} onChange={v => updItem(i, "state", v)} placeholder="NY" />
                    </Field>
                    <Field label="Nombre del empleador en este evento" hint="Si difiere del peticionario principal">
                      <TextInput value={item.employerName} onChange={v => updItem(i, "employerName", v)}
                        placeholder="Madison Square Garden Entertainment..." />
                    </Field>
                  </div>
                </Card>
              ))}
              <AddBtn label="Agregar evento" onClick={() => onChange({ ...d, itineraryItems: [...d.itineraryItems, emptyItem()] })} />
            </div>
          )}
        </>
      )}

      {/* ── Presentación ante USCIS ───────────────────────────────────────── */}
      <SectionDivider title="Presentación ante USCIS" />

      <Field label="¿Desea Procesamiento Prioritario (Premium Processing / I-907)?">
        <YesNo value={d.wantsPremiumProcessing} onChange={v => set("wantsPremiumProcessing", v)}
          yesLabel="Sí, con Premium Processing" noLabel="No" />
      </Field>

      {visaType === "EB-1A" && (
        <>
          <Field label="¿En qué estado trabajará el beneficiario en EE.UU.?">
            <TextInput value={d.beneficiaryWorkState} onChange={v => set("beneficiaryWorkState", v)}
              placeholder="California, Texas, New York..." />
          </Field>

          <Field label="¿El Formulario I-485 se presentará junto con el I-140, o después de que el I-140 sea aprobado?">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { val: true, label: "Concurrente (junto con el I-140)" },
                { val: false, label: "Después de la aprobación del I-140" },
              ].map(({ val, label }) => (
                <button key={String(val)} type="button" onClick={() => set("filesI485Concurrent", val)}
                  className={`rounded-xl border-2 p-4 text-left text-sm font-medium transition-all ${
                    d.filesI485Concurrent === val
                      ? "border-[#1B2B5E] bg-[#1B2B5E]/5 text-[#1B2B5E]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}
