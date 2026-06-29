import type { Module6, CertEntry } from "../types";
import { Field, TextInput, Select, YesNo, AddBtn, Card } from "../primitives";

type Props = { data: Module6; onChange: (d: Module6) => void };

const emptyCert = (): CertEntry => ({
  id: Math.random().toString(36).slice(2,9),
  name:"", institution:"", country:"", year:"", isActive:"", hasCertificate: null,
});

export function Module6({ data: d, onChange }: Props) {
  const addCert = () => onChange({ certifications: [...d.certifications, emptyCert()] });
  const removeCert = (i: number) => onChange({ certifications: d.certifications.filter((_,idx) => idx !== i) });
  const updCert = <K extends keyof CertEntry>(i: number, f: K, v: CertEntry[K]) => {
    const arr = [...d.certifications]; arr[i] = { ...arr[i], [f]: v }; onChange({ certifications: arr });
  };

  return (
    <div className="space-y-4">
      {d.certifications.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          Si no tienes cursos o certificaciones relevantes, puedes dejar este módulo vacío.
        </p>
      )}
      {d.certifications.map((c, i) => (
        <Card key={c.id} label="Certificación" index={i} onRemove={() => removeCert(i)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre del curso o certificación">
              <TextInput value={c.name} onChange={v => updCert(i,"name",v)} placeholder="AWS Solutions Architect, PMP, Google Analytics..."/>
            </Field>
            <Field label="Institución que lo emitió">
              <TextInput value={c.institution} onChange={v => updCert(i,"institution",v)} placeholder="Amazon, PMI, Google, Coursera..."/>
            </Field>
            <Field label="País">
              <TextInput value={c.country} onChange={v => updCert(i,"country",v)} placeholder="USA, Online..."/>
            </Field>
            <Field label="Año">
              <TextInput type="number" value={c.year} onChange={v => updCert(i,"year",v)} placeholder="2022"/>
            </Field>
            <Field label="¿Está vigente?">
              <Select value={c.isActive} onChange={v => updCert(i,"isActive",v)}>
                <option value="">Selecciona...</option>
                <option value="si">Sí, vigente</option>
                <option value="no">No, venció</option>
                <option value="no_aplica">No aplica (no vence)</option>
              </Select>
            </Field>
            <Field label="¿Tiene el certificado?">
              <YesNo value={c.hasCertificate} onChange={v => updCert(i,"hasCertificate",v)} yesLabel="Sí" noLabel="No"/>
            </Field>
          </div>
        </Card>
      ))}
      <AddBtn label="Agregar certificación" onClick={addCert}/>
    </div>
  );
}
