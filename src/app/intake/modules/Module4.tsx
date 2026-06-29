import type { Module4, UsaVisit, VisaRejection } from "../types";
import { Field, TextInput, Textarea, Select, YesNo, AddBtn, Card } from "../primitives";

type Props = { data: Module4; onChange: (d: Module4) => void };

const emptyVisit = (): UsaVisit => ({ id: Math.random().toString(36).slice(2,9), entryDate:"", exitDate:"", visaType:"", purpose:"" });
const emptyRejection = (): VisaRejection => ({ id: Math.random().toString(36).slice(2,9), country:"", visaType:"", year:"", reason:"" });

export function Module4({ data: d, onChange }: Props) {
  const u = <K extends keyof Module4>(f: K, v: Module4[K]) => onChange({ ...d, [f]: v });

  const addVisit = () => u("usaVisits", [...d.usaVisits, emptyVisit()]);
  const removeVisit = (i: number) => u("usaVisits", d.usaVisits.filter((_,idx) => idx !== i));
  const updVisit = <K extends keyof UsaVisit>(i: number, f: K, v: UsaVisit[K]) => {
    const arr = [...d.usaVisits]; arr[i] = { ...arr[i], [f]: v }; u("usaVisits", arr);
  };

  const addRejection = () => u("visaRejections", [...d.visaRejections, emptyRejection()]);
  const removeRejection = (i: number) => u("visaRejections", d.visaRejections.filter((_,idx) => idx !== i));
  const updRejection = <K extends keyof VisaRejection>(i: number, f: K, v: VisaRejection[K]) => {
    const arr = [...d.visaRejections]; arr[i] = { ...arr[i], [f]: v }; u("visaRejections", arr);
  };

  return (
    <div className="space-y-6">
      {/* USA visits */}
      <div className="space-y-4">
        <Field label="¿Ha estado alguna vez en Estados Unidos?" required>
          <YesNo value={d.hasBeenInUSA} onChange={v => u("hasBeenInUSA", v)} yesLabel="Sí, he estado" noLabel="Nunca"/>
        </Field>
        {d.hasBeenInUSA === true && (
          <div className="space-y-3">
            {d.usaVisits.map((v, i) => (
              <Card key={v.id} label="Visita" index={i} onRemove={d.usaVisits.length > 1 ? () => removeVisit(i) : undefined}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Fecha de entrada">
                    <TextInput type="date" value={v.entryDate} onChange={val => updVisit(i,"entryDate",val)}/>
                  </Field>
                  <Field label="Fecha de salida">
                    <TextInput type="date" value={v.exitDate} onChange={val => updVisit(i,"exitDate",val)}/>
                  </Field>
                  <Field label="Tipo de visa con la que entró">
                    <TextInput value={v.visaType} onChange={val => updVisit(i,"visaType",val)} placeholder="B1/B2, F-1, H-1B..."/>
                  </Field>
                  <Field label="Propósito de la visita">
                    <TextInput value={v.purpose} onChange={val => updVisit(i,"purpose",val)} placeholder="Turismo, estudios, trabajo..."/>
                  </Field>
                </div>
              </Card>
            ))}
            <AddBtn label="Agregar otra visita" onClick={addVisit}/>
          </div>
        )}
      </div>

      {/* Current visa */}
      <div className="space-y-3">
        <Field label="¿Tiene visa americana vigente actualmente?" required>
          <YesNo value={d.hasCurrentUSVisa} onChange={v => u("hasCurrentUSVisa", v)} yesLabel="Sí" noLabel="No"/>
        </Field>
        {d.hasCurrentUSVisa === true && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo de visa">
              <TextInput value={d.currentVisaType} onChange={v => u("currentVisaType",v)} placeholder="B1/B2, F-1, H-1B..."/>
            </Field>
            <Field label="Fecha de vencimiento">
              <TextInput type="date" value={d.currentVisaExpiry} onChange={v => u("currentVisaExpiry",v)}/>
            </Field>
          </div>
        )}
      </div>

      {/* Rejections */}
      <div className="space-y-3">
        <Field label="¿Ha tenido alguna visa rechazada?" required>
          <YesNo value={d.hasVisaRejection} onChange={v => u("hasVisaRejection", v)} yesLabel="Sí" noLabel="No"/>
        </Field>
        {d.hasVisaRejection === true && (
          <div className="space-y-3">
            {d.visaRejections.map((r, i) => (
              <Card key={r.id} label="Rechazo" index={i} onRemove={d.visaRejections.length > 1 ? () => removeRejection(i) : undefined}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="País">
                    <TextInput value={r.country} onChange={v => updRejection(i,"country",v)} placeholder="USA, Canadá..."/>
                  </Field>
                  <Field label="Tipo de visa">
                    <TextInput value={r.visaType} onChange={v => updRejection(i,"visaType",v)} placeholder="B2, F-1..."/>
                  </Field>
                  <Field label="Año aproximado">
                    <TextInput type="number" value={r.year} onChange={v => updRejection(i,"year",v)} placeholder="2019"/>
                  </Field>
                  <Field label="Razón si la conoce" hint="Opcional">
                    <TextInput value={r.reason} onChange={v => updRejection(i,"reason",v)} placeholder="Vínculos insuficientes con el país..."/>
                  </Field>
                </div>
              </Card>
            ))}
            <AddBtn label="Agregar otro rechazo" onClick={addRejection}/>
          </div>
        )}
      </div>

      {/* Deportation */}
      <div className="space-y-3">
        <Field label="¿Ha sido deportado o ha tenido problemas migratorios serios?" required>
          <YesNo value={d.hasDeportation} onChange={v => u("hasDeportation", v)} yesLabel="Sí" noLabel="No"/>
        </Field>
        {d.hasDeportation === true && (
          <Field label="Descripción breve">
            <Textarea value={d.deportationDescription} onChange={v => u("deportationDescription",v)}
              placeholder="Describe brevemente qué ocurrió..." rows={3}/>
          </Field>
        )}
      </div>
    </div>
  );
}
