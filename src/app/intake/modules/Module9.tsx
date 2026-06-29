import type { Module9, ReferenceEntry } from "../types";
import { Field, TextInput, Textarea, YesNo, AddBtn, Card, InfoBox } from "../primitives";

type Props = { data: Module9; onChange: (d: Module9) => void };

const emptyRef = (): ReferenceEntry => ({
  id: Math.random().toString(36).slice(2,9),
  name:"", currentTitle:"", company:"", country:"", email:"", phone:"",
  howYouKnow:"", whatTheyCouldSay:"", hasBeenAsked:null,
});

export function Module9({ data: d, onChange }: Props) {
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
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="¿Cómo conoces a esta persona?">
              <TextInput value={r.howYouKnow} onChange={v => upd(i,"howYouKnow",v)}
                placeholder="Ex-supervisor, colaborador en proyecto X, mentor desde 2015..."/>
            </Field>
            <Field label="¿Qué podría decir sobre tu trabajo?">
              <Textarea value={r.whatTheyCouldSay} onChange={v => upd(i,"whatTheyCouldSay",v)}
                placeholder="Podría confirmar mi rol crítico en el proyecto Y y mi impacto en..." rows={2}/>
            </Field>
            <Field label="¿Ya le has mencionado que podría ser referencia?">
              <YesNo value={r.hasBeenAsked} onChange={v => upd(i,"hasBeenAsked",v)} yesLabel="Sí, lo sabe" noLabel="Todavía no"/>
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
