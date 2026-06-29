import type { Module3, ChildInfo } from "../types";
import { Field, TextInput, Select, YesNo, AddBtn, Card } from "../primitives";

type Props = { data: Module3; onChange: (d: Module3) => void };

const emptyChild = (): ChildInfo => ({
  id: Math.random().toString(36).slice(2,9),
  name: "", dateOfBirth: "", nationality: "", countryOfResidence: "",
});

export function Module3({ data: d, onChange }: Props) {
  const u = <K extends keyof Module3>(f: K, v: Module3[K]) => onChange({ ...d, [f]: v });

  const addChild = () => u("children", [...d.children, emptyChild()]);
  const removeChild = (i: number) => u("children", d.children.filter((_, idx) => idx !== i));
  const updChild = <K extends keyof ChildInfo>(i: number, f: K, v: ChildInfo[K]) => {
    const arr = [...d.children];
    arr[i] = { ...arr[i], [f]: v };
    u("children", arr);
  };

  const isMarried = d.maritalStatus === "casado" || d.maritalStatus === "union_libre";

  return (
    <div className="space-y-5">
      <Field label="Estado civil" required>
        <Select value={d.maritalStatus} onChange={v => u("maritalStatus", v)}>
          <option value="">Selecciona...</option>
          <option value="soltero">Soltero/a</option>
          <option value="casado">Casado/a</option>
          <option value="union_libre">Unión libre</option>
          <option value="divorciado">Divorciado/a</option>
          <option value="viudo">Viudo/a</option>
        </Select>
      </Field>

      {isMarried && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
          <p className="text-sm font-bold text-gray-700">Información del cónyuge / pareja</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo">
              <TextInput value={d.spouse.name} onChange={v => u("spouse", { ...d.spouse, name: v })} placeholder="Ana Martínez"/>
            </Field>
            <Field label="Nacionalidad">
              <TextInput value={d.spouse.nationality} onChange={v => u("spouse", { ...d.spouse, nationality: v })} placeholder="Venezolana"/>
            </Field>
            <Field label="País de residencia">
              <TextInput value={d.spouse.countryOfResidence} onChange={v => u("spouse", { ...d.spouse, countryOfResidence: v })} placeholder="Colombia"/>
            </Field>
            <Field label="Profesión">
              <TextInput value={d.spouse.profession} onChange={v => u("spouse", { ...d.spouse, profession: v })} placeholder="Contadora"/>
            </Field>
          </div>
        </div>
      )}

      <Field label="¿Tiene hijos?" required>
        <YesNo value={d.hasChildren} onChange={v => u("hasChildren", v)} yesLabel="Sí" noLabel="No"/>
      </Field>

      {d.hasChildren === true && (
        <div className="space-y-3">
          {d.children.map((c, i) => (
            <Card key={c.id} label="Hijo/a" index={i} onRemove={d.children.length > 1 ? () => removeChild(i) : undefined}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre completo">
                  <TextInput value={c.name} onChange={v => updChild(i, "name", v)} placeholder="Luis Rodríguez"/>
                </Field>
                <Field label="Fecha de nacimiento">
                  <TextInput type="date" value={c.dateOfBirth} onChange={v => updChild(i, "dateOfBirth", v)}/>
                </Field>
                <Field label="Nacionalidad">
                  <TextInput value={c.nationality} onChange={v => updChild(i, "nationality", v)} placeholder="Colombiana"/>
                </Field>
                <Field label="País de residencia">
                  <TextInput value={c.countryOfResidence} onChange={v => updChild(i, "countryOfResidence", v)} placeholder="Colombia"/>
                </Field>
              </div>
            </Card>
          ))}
          <AddBtn label="Agregar hijo/a" onClick={addChild}/>
        </div>
      )}
    </div>
  );
}
