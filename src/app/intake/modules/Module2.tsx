import type { Module2, DocField, ChildDocSet } from "../types";
import { Field, TextInput, DocSelector, YesNo, AddBtn, RemoveBtn, InfoBox, SectionDivider } from "../primitives";

type Props = { data: Module2; onChange: (d: Module2) => void };

function DocRow({ label, value, onChange }: { label: string; value: DocField; onChange: (v: DocField) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <DocSelector value={value.has} onChange={has => onChange({ ...value, has })}/>
      {value.has === true && (
        <Field label="Notas (vigencia, número, etc.)" hint="">
          <TextInput value={value.notes} onChange={notes => onChange({ ...value, notes })} placeholder="Ej: vence 2027-05-14"/>
        </Field>
      )}
    </div>
  );
}

const emptyDoc = (): DocField => ({ has: null, notes: "" });
const emptyChildDoc = (): ChildDocSet => ({
  id: Math.random().toString(36).slice(2,9),
  childName: "",
  birthCert: emptyDoc(),
  passport: emptyDoc(),
  visa: emptyDoc(),
});

export function Module2({ data: d, onChange }: Props) {
  const u = <K extends keyof Module2>(f: K, v: Module2[K]) => onChange({ ...d, [f]: v });

  const addChild = () => u("childrenDocs", [...d.childrenDocs, emptyChildDoc()]);
  const removeChild = (i: number) => u("childrenDocs", d.childrenDocs.filter((_, idx) => idx !== i));
  const updChild = <K extends keyof ChildDocSet>(i: number, f: K, v: ChildDocSet[K]) => {
    const arr = [...d.childrenDocs];
    arr[i] = { ...arr[i], [f]: v };
    u("childrenDocs", arr);
  };

  return (
    <div className="space-y-5">
      <InfoBox>
        Sube los documentos que tengas disponibles ahora. Puedes completar este módulo después
        desde tu portal de cliente.
      </InfoBox>

      <SectionDivider title="Documentos personales"/>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DocRow label="Pasaporte (página principal)"       value={d.passport}   onChange={v => u("passport", v)}/>
        <DocRow label="Visa americana vigente"              value={d.usVisa}     onChange={v => u("usVisa", v)}/>
        <DocRow label="I-94 (si estuvo o está en USA)"     value={d.i94}        onChange={v => u("i94", v)}/>
        <DocRow label="I-797"                               value={d.i797}       onChange={v => u("i797", v)}/>
        <DocRow label="EAD (Employment Authorization)"     value={d.ead}        onChange={v => u("ead", v)}/>
        <DocRow label="I-20 (F-1 student)"                 value={d.i20}        onChange={v => u("i20", v)}/>
        <DocRow label="DS-2019 (J-1 exchange visitor)"     value={d.ds2019}     onChange={v => u("ds2019", v)}/>
      </div>

      <SectionDivider title="Estado civil (para documentos del cónyuge)"/>
      <Field label="¿Está casado/a actualmente?">
        <YesNo value={d.isMarried} onChange={v => u("isMarried", v)} yesLabel="Sí, casado/a" noLabel="No"/>
      </Field>
      {d.isMarried === true && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DocRow label="Registro civil de matrimonio"  value={d.spouseMarriageCert} onChange={v => u("spouseMarriageCert", v)}/>
          <DocRow label="Pasaporte del cónyuge"         value={d.spousePassport}     onChange={v => u("spousePassport", v)}/>
          <DocRow label="Visa del cónyuge"              value={d.spouseVisa}         onChange={v => u("spouseVisa", v)}/>
          <DocRow label="I-94 del cónyuge"              value={d.spouseI94}          onChange={v => u("spouseI94", v)}/>
        </div>
      )}

      <SectionDivider title="Hijos"/>
      <Field label="¿Tiene hijos?">
        <YesNo value={d.hasChildren} onChange={v => u("hasChildren", v)} yesLabel="Sí" noLabel="No"/>
      </Field>
      {d.hasChildren === true && (
        <div className="space-y-4">
          {d.childrenDocs.map((c, i) => (
            <div key={c.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-9">
              <div className="absolute left-4 top-3 text-xs font-bold uppercase tracking-wider text-brand-blue">Hijo/a {i + 1}</div>
              {d.childrenDocs.length > 1 && (
                <button type="button" onClick={() => removeChild(i)}
                  className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                  ✕
                </button>
              )}
              <div className="space-y-3">
                <Field label="Nombre del hijo/a">
                  <TextInput value={c.childName} onChange={v => updChild(i, "childName", v)} placeholder="María Rodríguez"/>
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <DocRow label="Registro de nacimiento" value={c.birthCert} onChange={v => updChild(i, "birthCert", v)}/>
                  <DocRow label="Pasaporte"              value={c.passport}  onChange={v => updChild(i, "passport", v)}/>
                  <DocRow label="Visa"                   value={c.visa}      onChange={v => updChild(i, "visa", v)}/>
                </div>
              </div>
            </div>
          ))}
          <AddBtn label="Agregar hijo/a" onClick={addChild}/>
        </div>
      )}
    </div>
  );
}
