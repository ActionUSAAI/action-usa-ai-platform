import type { Module7, EmploymentEntry } from "../types";
import { Field, TextInput, Textarea, Select, YesNo, AddBtn, Card, InfoBox, SectionDivider } from "../primitives";

type Props = { data: Module7; onChange: (d: Module7) => void };

const emptyJob = (): EmploymentEntry => ({
  id: Math.random().toString(36).slice(2,9),
  company:"", country:"", city:"", title:"", startDate:"", endDate:"", isCurrent:false,
  mainFunctions:"", importantProjects:"", mainAchievements:"",
  peopleSupervised:"0", managesBudget:null, budgetAmount:"",
  whyImportant:"",
  supervisorName:"", supervisorTitle:"", supervisorEmail:"", supervisorPhone:"",
  companyWebsite:"", internationalRecognition:"",
});

export function Module7({ data: d, onChange }: Props) {
  const addJob = () => onChange({ employment: [...d.employment, emptyJob()] });
  const removeJob = (i: number) => onChange({ employment: d.employment.filter((_,idx) => idx !== i) });
  const upd = <K extends keyof EmploymentEntry>(i: number, f: K, v: EmploymentEntry[K]) => {
    const arr = [...d.employment]; arr[i] = { ...arr[i], [f]: v }; onChange({ employment: arr });
  };

  return (
    <div className="space-y-4">
      <InfoBox>
        Esta información es confidencial y nos permite identificar qué empleos son más relevantes
        para fortalecer tu caso.
      </InfoBox>

      {d.employment.map((e, i) => (
        <Card key={e.id} label="Empleo" index={i} onRemove={d.employment.length > 1 ? () => removeJob(i) : undefined}>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Empresa">
                <TextInput value={e.company} onChange={v => upd(i,"company",v)} placeholder="Netflix, Mayo Clinic, MIT..."/>
              </Field>
              <Field label="Cargo / Título">
                <TextInput value={e.title} onChange={v => upd(i,"title",v)} placeholder="Director de Fotografía, Lead Surgeon..."/>
              </Field>
              <Field label="País">
                <TextInput value={e.country} onChange={v => upd(i,"country",v)} placeholder="Colombia"/>
              </Field>
              <Field label="Ciudad">
                <TextInput value={e.city} onChange={v => upd(i,"city",v)} placeholder="Bogotá"/>
              </Field>
              <Field label="Fecha de inicio">
                <TextInput type="month" value={e.startDate} onChange={v => upd(i,"startDate",v)}/>
              </Field>
              <Field label="Fecha de finalización">
                <div className="flex items-center gap-2">
                  <TextInput type="month" value={e.endDate} onChange={v => upd(i,"endDate",v)} disabled={e.isCurrent}/>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={e.isCurrent}
                      onChange={ev => upd(i,"isCurrent", ev.target.checked)}
                      className="accent-brand-blue"/>
                    Actual
                  </label>
                </div>
              </Field>
            </div>

            <SectionDivider title="Descripción del rol"/>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Descripción de funciones principales">
                <Textarea value={e.mainFunctions} onChange={v => upd(i,"mainFunctions",v)}
                  placeholder="Describe tus responsabilidades principales..." rows={3}/>
              </Field>
              <Field label="Proyectos más importantes">
                <Textarea value={e.importantProjects} onChange={v => upd(i,"importantProjects",v)}
                  placeholder="Proyectos clave en los que participaste o lideraste..." rows={2}/>
              </Field>
              <Field label="Logros principales">
                <Textarea value={e.mainAchievements} onChange={v => upd(i,"mainAchievements",v)}
                  placeholder="Resultados medibles: +$5M en ventas, reduje costos 30%..." rows={2}/>
              </Field>
              <Field label="¿Por qué este empleo fue importante en tu carrera?">
                <Textarea value={e.whyImportant} onChange={v => upd(i,"whyImportant",v)}
                  placeholder="Por qué fue un punto de inflexión o destacó en tu trayectoria..." rows={2}/>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="¿Cuántas personas supervisabas? (0 si ninguna)">
                <TextInput type="number" value={e.peopleSupervised} onChange={v => upd(i,"peopleSupervised",v)} placeholder="0"/>
              </Field>
              <Field label="¿La empresa tiene reconocimiento nacional o internacional?">
                <Select value={e.internationalRecognition} onChange={v => upd(i,"internationalRecognition",v)}>
                  <option value="">Selecciona...</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                  <option value="no_se">No sé</option>
                </Select>
              </Field>
            </div>

            <div className="space-y-3">
              <Field label="¿Manejabas presupuesto?">
                <YesNo value={e.managesBudget} onChange={v => upd(i,"managesBudget",v)} yesLabel="Sí" noLabel="No"/>
              </Field>
              {e.managesBudget === true && (
                <Field label="Monto aproximado (USD)">
                  <TextInput value={e.budgetAmount} onChange={v => upd(i,"budgetAmount",v)} placeholder="500,000"/>
                </Field>
              )}
            </div>

            <SectionDivider title="Referencia / supervisor"/>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre del supervisor">
                <TextInput value={e.supervisorName} onChange={v => upd(i,"supervisorName",v)} placeholder="Dr. Robert Chen"/>
              </Field>
              <Field label="Cargo del supervisor">
                <TextInput value={e.supervisorTitle} onChange={v => upd(i,"supervisorTitle",v)} placeholder="CTO, Dean, VP Engineering..."/>
              </Field>
              <Field label="Email del supervisor">
                <TextInput type="email" value={e.supervisorEmail} onChange={v => upd(i,"supervisorEmail",v)} placeholder="rchen@empresa.com"/>
              </Field>
              <Field label="Teléfono del supervisor" hint="Opcional">
                <TextInput value={e.supervisorPhone} onChange={v => upd(i,"supervisorPhone",v)} placeholder="+1 555 000 0000"/>
              </Field>
              <Field label="Página web de la empresa" hint="Opcional">
                <TextInput value={e.companyWebsite} onChange={v => upd(i,"companyWebsite",v)} placeholder="https://empresa.com"/>
              </Field>
            </div>
          </div>
        </Card>
      ))}
      <AddBtn label="Agregar empleo" onClick={addJob}/>
    </div>
  );
}
