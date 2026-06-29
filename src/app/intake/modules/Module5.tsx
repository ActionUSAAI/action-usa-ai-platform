import type { Module5, DegreeEntry } from "../types";
import { Field, TextInput, Select, AddBtn, Card, FileUpload } from "../primitives";

type Props = { data: Module5; onChange: (d: Module5) => void; sessionId: string };

const emptyDegree = (): DegreeEntry => ({
  id: Math.random().toString(36).slice(2,9),
  institution:"", country:"", degreeType:"", degreeName:"",
  startYear:"", graduationYear:"", hasDiploma:"",
  filePath:"", fileName:"",
});

export function Module5({ data: d, onChange, sessionId }: Props) {
  const addDegree = () => onChange({ degrees: [...d.degrees, emptyDegree()] });
  const removeDegree = (i: number) => onChange({ degrees: d.degrees.filter((_,idx) => idx !== i) });
  const updDegree = <K extends keyof DegreeEntry>(i: number, f: K, v: DegreeEntry[K]) => {
    const arr = [...d.degrees]; arr[i] = { ...arr[i], [f]: v }; onChange({ degrees: arr });
  };

  return (
    <div className="space-y-4">
      {d.degrees.map((deg, i) => (
        <Card key={deg.id} label="Título" index={i} onRemove={d.degrees.length > 1 ? () => removeDegree(i) : undefined}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Institución">
              <TextInput value={deg.institution} onChange={v => updDegree(i,"institution",v)} placeholder="Universidad de los Andes"/>
            </Field>
            <Field label="País">
              <TextInput value={deg.country} onChange={v => updDegree(i,"country",v)} placeholder="Colombia"/>
            </Field>
            <Field label="Tipo de título">
              <Select value={deg.degreeType} onChange={v => updDegree(i,"degreeType",v)}>
                <option value="">Selecciona...</option>
                <option value="pregrado">Pregrado / Licenciatura</option>
                <option value="especializacion">Especialización</option>
                <option value="maestria">Maestría</option>
                <option value="mba">MBA</option>
                <option value="doctorado">Doctorado (PhD / MD)</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Nombre del título / Carrera">
              <TextInput value={deg.degreeName} onChange={v => updDegree(i,"degreeName",v)} placeholder="Ingeniería de Sistemas, Medicina..."/>
            </Field>
            <Field label="Año de inicio">
              <TextInput type="number" value={deg.startYear} onChange={v => updDegree(i,"startYear",v)} placeholder="2010"/>
            </Field>
            <Field label="Año de graduación">
              <TextInput type="number" value={deg.graduationYear} onChange={v => updDegree(i,"graduationYear",v)} placeholder="2015"/>
            </Field>
            <Field label="¿Tiene el diploma físico?">
              <Select value={deg.hasDiploma} onChange={v => updDegree(i,"hasDiploma",v)}>
                <option value="">Selecciona...</option>
                <option value="si">Sí, lo tengo</option>
                <option value="no">No</option>
                <option value="en_tramite">En trámite</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <FileUpload
              sessionId={sessionId}
              storagePath={`module5/${deg.id}`}
              filePath={deg.filePath}
              fileName={deg.fileName}
              onChange={({ filePath, fileName }) => { updDegree(i,"filePath",filePath); updDegree(i,"fileName",fileName); }}
            />
          </div>
        </Card>
      ))}
      <AddBtn label="Agregar título académico" onClick={addDegree}/>
    </div>
  );
}
