import type { Module1 } from "../types";
import { Field, TextInput, Textarea, Select, YesNo } from "../primitives";
import { composeFullName } from "../name-utils";

type Props = { data: Module1; onChange: (d: Module1) => void; errors: Record<string, string> };

export function Module1({ data: d, onChange, errors: err }: Props) {
  const u = <K extends keyof Module1>(f: K, v: Module1[K]) => onChange({ ...d, [f]: v });

  function updateNameField(field: "familyName" | "givenName" | "middleName", value: string) {
    const updated = { ...d, [field]: value };
    const fullName = composeFullName(updated.familyName, updated.givenName, updated.middleName);
    onChange({ ...updated, fullName });
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Apellido(s)" required error={err.familyName}>
          <TextInput value={d.familyName} onChange={v => updateNameField("familyName", v)} placeholder="Rodríguez"/>
        </Field>
        <Field label="Nombre(s)" required error={err.givenName}>
          <TextInput value={d.givenName} onChange={v => updateNameField("givenName", v)} placeholder="Juan Carlos"/>
        </Field>
        <Field label="Segundo nombre" error={err.middleName}>
          <TextInput value={d.middleName} onChange={v => updateNameField("middleName", v)} placeholder="(opcional)"/>
        </Field>
        <Field label="Nombre completo (generado automáticamente)">
          <TextInput value={d.fullName} onChange={() => {}} disabled placeholder=""/>
        </Field>
        <Field label="Fecha de nacimiento" required error={err.dateOfBirth}>
          <TextInput type="date" value={d.dateOfBirth} onChange={v => u("dateOfBirth", v)}/>
        </Field>
        <Field label="País de nacimiento" required error={err.countryOfBirth}>
          <TextInput value={d.countryOfBirth} onChange={v => u("countryOfBirth", v)} placeholder="Colombia"/>
        </Field>
        <Field label="Nacionalidad(es)" required error={err.nationalities}
          hint="Si tienes más de una, sepáralas con coma">
          <TextInput value={d.nationalities} onChange={v => u("nationalities", v)} placeholder="Colombiana, Española"/>
        </Field>
        <Field label="País de residencia actual" required error={err.countryOfResidence}>
          <TextInput value={d.countryOfResidence} onChange={v => u("countryOfResidence", v)} placeholder="México"/>
        </Field>
        <Field label="Ciudad de residencia actual" required error={err.cityOfResidence}>
          <TextInput value={d.cityOfResidence} onChange={v => u("cityOfResidence", v)} placeholder="Ciudad de México"/>
        </Field>

        <Field label="¿Quiere hacer cambio de estatus dentro de EE.UU.?" required>
          <YesNo value={d.willChangeStatusInUSA} onChange={v => u("willChangeStatusInUSA", v)} yesLabel="Sí" noLabel="No"/>
        </Field>

        <Field label="Dirección extranjera — Calle y número" required>
          <TextInput value={d.beneficiaryForeignStreetNumberName} onChange={v => u("beneficiaryForeignStreetNumberName", v)} placeholder="Calle 10 # 20-30"/>
        </Field>
        <Field label="Ciudad (extranjero)" required>
          <TextInput value={d.beneficiaryForeignCity} onChange={v => u("beneficiaryForeignCity", v)} placeholder="Cali"/>
        </Field>
        <Field label="Provincia/Departamento (extranjero)">
          <TextInput value={d.beneficiaryForeignProvince} onChange={v => u("beneficiaryForeignProvince", v)} placeholder="Valle del Cauca"/>
        </Field>
        <Field label="Código postal (extranjero)">
          <TextInput value={d.beneficiaryForeignPostalCode} onChange={v => u("beneficiaryForeignPostalCode", v)} placeholder="760001"/>
        </Field>
        <Field label="País (extranjero)" required>
          <TextInput value={d.beneficiaryForeignCountry} onChange={v => u("beneficiaryForeignCountry", v)} placeholder="Colombia"/>
        </Field>

        {d.willChangeStatusInUSA === true && (
          <>
            <Field label="Dirección en EE.UU. — Calle y número" required>
              <TextInput value={d.beneficiaryUSStreetNumberName} onChange={v => u("beneficiaryUSStreetNumberName", v)} placeholder="123 Main St"/>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Tipo">
                <Select value={d.beneficiaryUSAptSteFlr} onChange={v => u("beneficiaryUSAptSteFlr", v as "APT" | "STE" | "FLR" | "")}>
                  <option value="">—</option>
                  <option value="APT">Apt</option>
                  <option value="STE">Ste</option>
                  <option value="FLR">Flr</option>
                </Select>
              </Field>
              <Field label="Número">
                <TextInput value={d.beneficiaryUSAptSteFlrNumber} onChange={v => u("beneficiaryUSAptSteFlrNumber", v)} placeholder="400"/>
              </Field>
              <Field label="ZIP" required>
                <TextInput value={d.beneficiaryUSZipCode} onChange={v => u("beneficiaryUSZipCode", v)} placeholder="90001"/>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ciudad (EE.UU.)" required>
                <TextInput value={d.beneficiaryUSCity} onChange={v => u("beneficiaryUSCity", v)} placeholder="Los Angeles"/>
              </Field>
              <Field label="Estado (EE.UU.)" required>
                <TextInput value={d.beneficiaryUSState} onChange={v => u("beneficiaryUSState", v)} placeholder="CA"/>
              </Field>
            </div>
          </>
        )}

        <Field label="Email" required error={err.email}>
          <TextInput type="email" value={d.email} onChange={v => u("email", v)} placeholder="juan@ejemplo.com"/>
        </Field>
        <Field label="WhatsApp (con código de país)" required error={err.whatsapp}>
          <TextInput value={d.whatsapp} onChange={v => u("whatsapp", v)} placeholder="+57 300 123 4567"/>
        </Field>
        <Field label="Profesión principal" required error={err.profession}>
          <TextInput value={d.profession} onChange={v => u("profession", v)} placeholder="Director de Cine, Cirujano, Software Engineer..."/>
        </Field>
        <Field label="Campo o industria" required error={err.industry}>
          <TextInput value={d.industry} onChange={v => u("industry", v)} placeholder="Entretenimiento, Medicina, Tecnología..."/>
        </Field>
        <Field label="Años de experiencia" required error={err.yearsExperience}>
          <TextInput type="number" value={d.yearsExperience} onChange={v => u("yearsExperience", v)} placeholder="10"/>
        </Field>
        <Field label="Objetivo en USA" required error={err.usaObjective}>
          <Select value={d.usaObjective} onChange={v => u("usaObjective", v)}>
            <option value="">Selecciona...</option>
            <option value="trabajo">Trabajo</option>
            <option value="residencia_permanente">Residencia permanente</option>
            <option value="ambos">Ambos</option>
          </Select>
        </Field>
      </div>
      <Field label="Tipo de visa de interés" required error={err.visaType}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["O-1A","O-1B","EB-1A","EB-1B","no_se"] as const).map(v => (
            <button key={v} type="button" onClick={() => u("visaType", v)}
              className={`rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
                d.visaType === v ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
              {v === "no_se" ? "No sé" : v}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}
