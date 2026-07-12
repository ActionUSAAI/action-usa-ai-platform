import type { Module9, ReferenceEntry } from "../types";
import { Field, TextInput, Textarea, Select, AddBtn, Card, InfoBox } from "../primitives";
import { resolveCriteriaSet, criteriaSetForClassification } from "@/lib/canonical-criteria";

type Props = { data: Module9; onChange: (d: Module9) => void; visaType: string };

const emptyRef = (): ReferenceEntry => ({
  id: Math.random().toString(36).slice(2,9),
  name:"", currentTitle:"", company:"", country:"", email:"", phone:"",
  relationshipType:"", relationshipDuration:"", signerCredentials:"", specificAchievements:"",
  targetCriterionKey:"",
});

export function Module9({ data: d, onChange, visaType }: Props) {
  const { classification } = resolveCriteriaSet(visaType);
  const criteriaOptions = criteriaSetForClassification(classification);
  const addRef = () => onChange({ references: [...d.references, emptyRef()] });
  const removeRef = (i: number) => onChange({ references: d.references.filter((_,idx) => idx !== i) });
  const upd = <K extends keyof ReferenceEntry>(i: number, f: K, v: ReferenceEntry[K]) => {
    const arr = [...d.references]; arr[i] = { ...arr[i], [f]: v }; onChange({ references: arr });
  };

  return (
    <div className="space-y-4">
      <InfoBox>
        Estas son personas que podrían confirmar tu impacto profesional. No las contactaremos
        sin tu autorización previa. Agrega mínimo 3 referencias.
      </InfoBox>

      {d.references.map((r, i) => (
        <Card key={r.id} label="Referencia" index={i} onRemove={d.references.length > 1 ? () => removeRef(i) : undefined}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre completo">
              <TextInput value={r.name} onChange={v => upd(i,"name",v)} placeholder="Dr. Robert Chen"/>
            </Field>
            <Field label="Cargo actual">
              <TextInput value={r.currentTitle} onChange={v => upd(i,"currentTitle",v)} placeholder="Dean of Medicine, CTO, Festival Director..."/>
            </Field>
            <Field label="Empresa u organización">
              <TextInput value={r.company} onChange={v => upd(i,"company",v)} placeholder="Harvard Medical School, Pixar..."/>
            </Field>
            <Field label="País">
              <TextInput value={r.country} onChange={v => upd(i,"country",v)} placeholder="USA"/>
            </Field>
            <Field label="Email">
              <TextInput type="email" value={r.email} onChange={v => upd(i,"email",v)} placeholder="rchen@harvard.edu"/>
            </Field>
            <Field label="Teléfono" hint="Opcional">
              <TextInput value={r.phone} onChange={v => upd(i,"phone",v)} placeholder="+1 617 000 0000"/>
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="¿Qué relación tienen?">
              <Select value={r.relationshipType} onChange={v => upd(i,"relationshipType",v)}>
                <option value="">Selecciona...</option>
                <option value="supervisor">Supervisor(a)</option>
                <option value="colega">Colega</option>
                <option value="cliente">Cliente</option>
                <option value="mentor">Mentor(a)</option>
                <option value="colaborador">Colaborador(a)</option>
                <option value="subordinado">Subordinado(a)</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Criterio que sustenta la carta">
              <Select value={r.targetCriterionKey} onChange={v => upd(i, "targetCriterionKey", v)}>
                <option value="">¿Qué criterio sustenta esta carta?</option>
                {criteriaOptions.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="¿Desde cuándo se conocen o trabajan juntos?">
              <TextInput value={r.relationshipDuration} onChange={v => upd(i,"relationshipDuration",v)}
                placeholder="Desde 2019, hace 5 años, desde el proyecto X en 2021..."/>
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="¿Qué trayectoria o autoridad tiene esta persona en su campo?">
              <Textarea value={r.signerCredentials} onChange={v => upd(i,"signerCredentials",v)}
                placeholder="Cargo actual, años de experiencia, reconocimientos que respaldan su criterio..." rows={2}/>
            </Field>
            <Field label="¿Qué logros o resultados concretos tuyos podría confirmar?">
              <Textarea value={r.specificAchievements} onChange={v => upd(i,"specificAchievements",v)}
                placeholder="Fechas, proyectos específicos, cifras o resultados medibles — evita generalidades..." rows={2}/>
            </Field>
          </div>
        </Card>
      ))}
      <AddBtn label="Agregar referencia" onClick={addRef}/>
      {d.references.length < 3 && (
        <p className="text-xs text-amber-600 text-center">
          Recomendamos agregar al menos 3 referencias.
        </p>
      )}
    </div>
  );
}
