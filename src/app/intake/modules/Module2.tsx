import type { Module2, DocField, ChildDocSet, SpouseInfo } from "../types";
import {
  Field, TextInput, Select, DocSelector, YesNo,
  AddBtn, Card, InfoBox, SectionDivider, FileUpload,
} from "../primitives";

type Props = { data: Module2; onChange: (d: Module2) => void; sessionId: string };

type DocType = "passport" | "usVisa" | "generic";

function DocRow({ label, docType, value, onChange, sessionId, storagePath }: {
  label: string;
  docType: DocType;
  value: DocField;
  onChange: (v: DocField) => void;
  sessionId: string;
  storagePath: string;
}) {
  const upd = (patch: Partial<DocField>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <DocSelector value={value.has} onChange={has => upd({ has })}/>

      {value.has === true && (
        <>
          {docType === "passport" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Número de pasaporte">
                <TextInput value={value.documentNumber} onChange={v => upd({ documentNumber: v })} placeholder="A1234567"/>
              </Field>
              <Field label="País de expedición">
                <TextInput value={value.issuedCountry} onChange={v => upd({ issuedCountry: v })} placeholder="Colombia"/>
              </Field>
              <Field label="Ciudad de expedición">
                <TextInput value={value.issuedCity} onChange={v => upd({ issuedCity: v })} placeholder="Bogotá"/>
              </Field>
              <Field label="Fecha de expedición">
                <TextInput type="date" value={value.issuedDate} onChange={v => upd({ issuedDate: v })}/>
              </Field>
              <Field label="Fecha de vencimiento">
                <TextInput type="date" value={value.expiryDate} onChange={v => upd({ expiryDate: v })}/>
              </Field>
            </div>
          )}

          {docType === "usVisa" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Número de visa">
                <TextInput value={value.documentNumber} onChange={v => upd({ documentNumber: v })} placeholder="1234567890"/>
              </Field>
              <Field label="Tipo de visa">
                <Select value={value.visaSubtype} onChange={v => upd({ visaSubtype: v })}>
                  <option value="">Selecciona...</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="B1/B2">B1/B2</option>
                  <option value="F1">F1</option>
                  <option value="F2">F2</option>
                  <option value="J1">J1</option>
                  <option value="J2">J2</option>
                  <option value="H1B">H1B</option>
                  <option value="H4">H4</option>
                  <option value="O1">O1</option>
                  <option value="L1">L1</option>
                  <option value="TN">TN</option>
                  <option value="otro">Otro</option>
                </Select>
              </Field>
              <Field label="Lugar de expedición">
                <TextInput value={value.issuedCity} onChange={v => upd({ issuedCity: v })} placeholder="Bogotá"/>
              </Field>
              <Field label="Fecha de expedición">
                <TextInput type="date" value={value.issuedDate} onChange={v => upd({ issuedDate: v })}/>
              </Field>
              <Field label="Fecha de vencimiento">
                <TextInput type="date" value={value.expiryDate} onChange={v => upd({ expiryDate: v })}/>
              </Field>
            </div>
          )}

          {docType === "generic" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Número de documento">
                <TextInput value={value.documentNumber} onChange={v => upd({ documentNumber: v })} placeholder="1234567890"/>
              </Field>
              <Field label="Fecha de vencimiento">
                <TextInput type="date" value={value.expiryDate} onChange={v => upd({ expiryDate: v })}/>
              </Field>
            </div>
          )}

          <FileUpload
            sessionId={sessionId}
            storagePath={storagePath}
            filePath={value.filePath}
            fileName={value.fileName}
            onChange={({ filePath, fileName }) => upd({ filePath, fileName })}
          />
        </>
      )}
    </div>
  );
}

const emptyDoc = (): DocField => ({
  has: null, notes: "",
  documentNumber: "", expiryDate: "", issuedDate: "",
  issuedCountry: "", issuedCity: "", visaSubtype: "",
  filePath: "", fileName: "",
});

const emptyChildDoc = (): ChildDocSet => ({
  id: Math.random().toString(36).slice(2,9),
  childName: "", dateOfBirth: "", nationality: "", countryOfResidence: "",
  birthCert: emptyDoc(),
  passport: emptyDoc(),
  visa: emptyDoc(),
});

export function Module2({ data: d, onChange, sessionId }: Props) {
  const u = <K extends keyof Module2>(f: K, v: Module2[K]) => onChange({ ...d, [f]: v });
  const uSpouse = (patch: Partial<SpouseInfo>) => u("spouse", { ...d.spouse, ...patch });

  const addChild = () => u("childrenDocs", [...d.childrenDocs, emptyChildDoc()]);
  const removeChild = (i: number) => u("childrenDocs", d.childrenDocs.filter((_, idx) => idx !== i));
  const updChild = <K extends keyof ChildDocSet>(i: number, f: K, v: ChildDocSet[K]) => {
    const arr = [...d.childrenDocs];
    arr[i] = { ...arr[i], [f]: v };
    u("childrenDocs", arr);
  };

  const hasSpouse = d.maritalStatus === "casado" || d.maritalStatus === "union_libre";

  return (
    <div className="space-y-5">
      <InfoBox>
        Completa los campos que tengas disponibles y sube una copia del documento si es posible.
        Todo es opcional — puedes agregar más desde tu portal de cliente.
      </InfoBox>

      {/* ── Personal documents ── */}
      <SectionDivider title="Documentos personales"/>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DocRow label="Pasaporte (página principal)" docType="passport"
          value={d.passport} onChange={v => u("passport", v)}
          sessionId={sessionId} storagePath="module2/passport"/>
        <DocRow label="Visa americana vigente" docType="usVisa"
          value={d.usVisa} onChange={v => u("usVisa", v)}
          sessionId={sessionId} storagePath="module2/us-visa"/>
        <DocRow label="I-94 (si estuvo o está en USA)" docType="generic"
          value={d.i94} onChange={v => u("i94", v)}
          sessionId={sessionId} storagePath="module2/i94"/>
        <DocRow label="I-797" docType="generic"
          value={d.i797} onChange={v => u("i797", v)}
          sessionId={sessionId} storagePath="module2/i797"/>
        <DocRow label="EAD (Employment Authorization)" docType="generic"
          value={d.ead} onChange={v => u("ead", v)}
          sessionId={sessionId} storagePath="module2/ead"/>
        <DocRow label="I-20 (F-1 student)" docType="generic"
          value={d.i20} onChange={v => u("i20", v)}
          sessionId={sessionId} storagePath="module2/i20"/>
        <DocRow label="DS-2019 (J-1 exchange visitor)" docType="generic"
          value={d.ds2019} onChange={v => u("ds2019", v)}
          sessionId={sessionId} storagePath="module2/ds2019"/>
      </div>

      {/* ── Marital status ── */}
      <SectionDivider title="Estado civil"/>
      <Field label="Estado civil">
        <Select value={d.maritalStatus} onChange={v => u("maritalStatus", v)}>
          <option value="">Selecciona...</option>
          <option value="soltero">Soltero/a</option>
          <option value="casado">Casado/a</option>
          <option value="union_libre">Unión libre</option>
          <option value="divorciado">Divorciado/a</option>
          <option value="viudo">Viudo/a</option>
        </Select>
      </Field>

      {/* ── Spouse biographical + documents ── */}
      {hasSpouse && (
        <>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <p className="text-sm font-bold text-gray-700">Información del cónyuge / pareja</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre completo">
                <TextInput value={d.spouse.name} onChange={v => uSpouse({ name: v })} placeholder="Ana Martínez"/>
              </Field>
              <Field label="Nacionalidad">
                <TextInput value={d.spouse.nationality} onChange={v => uSpouse({ nationality: v })} placeholder="Venezolana"/>
              </Field>
              <Field label="País de residencia">
                <TextInput value={d.spouse.countryOfResidence} onChange={v => uSpouse({ countryOfResidence: v })} placeholder="Colombia"/>
              </Field>
              <Field label="Profesión">
                <TextInput value={d.spouse.profession} onChange={v => uSpouse({ profession: v })} placeholder="Contadora"/>
              </Field>
            </div>
          </div>

          <SectionDivider title="Documentos del cónyuge"/>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DocRow label="Registro civil de matrimonio" docType="generic"
              value={d.spouseMarriageCert} onChange={v => u("spouseMarriageCert", v)}
              sessionId={sessionId} storagePath="module2/spouse-marriage-cert"/>
            <DocRow label="Pasaporte del cónyuge" docType="passport"
              value={d.spousePassport} onChange={v => u("spousePassport", v)}
              sessionId={sessionId} storagePath="module2/spouse-passport"/>
            <DocRow label="Visa del cónyuge" docType="usVisa"
              value={d.spouseVisa} onChange={v => u("spouseVisa", v)}
              sessionId={sessionId} storagePath="module2/spouse-visa"/>
            <DocRow label="I-94 del cónyuge" docType="generic"
              value={d.spouseI94} onChange={v => u("spouseI94", v)}
              sessionId={sessionId} storagePath="module2/spouse-i94"/>
          </div>
        </>
      )}

      {/* ── Children ── */}
      <SectionDivider title="Hijos"/>
      <Field label="¿Tiene hijos?">
        <YesNo value={d.hasChildren} onChange={v => u("hasChildren", v)} yesLabel="Sí" noLabel="No"/>
      </Field>

      {d.hasChildren === true && (
        <div className="space-y-4">
          {d.childrenDocs.map((c, i) => (
            <Card key={c.id} label="Hijo/a" index={i}
              onRemove={d.childrenDocs.length > 1 ? () => removeChild(i) : undefined}>
              {/* Biographical */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
                <Field label="Nombre completo">
                  <TextInput value={c.childName} onChange={v => updChild(i, "childName", v)} placeholder="Luis Rodríguez"/>
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
              {/* Documents */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DocRow label="Registro de nacimiento" docType="generic"
                  value={c.birthCert} onChange={v => updChild(i, "birthCert", v)}
                  sessionId={sessionId} storagePath={`module2/child-${c.id}-birth-cert`}/>
                <DocRow label="Pasaporte" docType="passport"
                  value={c.passport} onChange={v => updChild(i, "passport", v)}
                  sessionId={sessionId} storagePath={`module2/child-${c.id}-passport`}/>
                <DocRow label="Visa" docType="usVisa"
                  value={c.visa} onChange={v => updChild(i, "visa", v)}
                  sessionId={sessionId} storagePath={`module2/child-${c.id}-visa`}/>
              </div>
            </Card>
          ))}
          <AddBtn label="Agregar hijo/a" onClick={addChild}/>
        </div>
      )}
    </div>
  );
}
