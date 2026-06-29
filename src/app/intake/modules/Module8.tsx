import type { Module8, BusinessEntry } from "../types";
import { Field, TextInput, Textarea, Select, YesNo, AddBtn, Card } from "../primitives";

type Props = { data: Module8; onChange: (d: Module8) => void };

const emptyBusiness = (): BusinessEntry => ({
  id: Math.random().toString(36).slice(2,9),
  name:"", country:"", foundedYear:"", industry:"", role:"",
  isActive:null, employeeCount:"", description:"", website:"",
});

export function Module8({ data: d, onChange }: Props) {
  const u = <K extends keyof Module8>(f: K, v: Module8[K]) => onChange({ ...d, [f]: v });

  const addBusiness = () => u("businesses", [...d.businesses, emptyBusiness()]);
  const removeBusiness = (i: number) => u("businesses", d.businesses.filter((_,idx) => idx !== i));
  const upd = <K extends keyof BusinessEntry>(i: number, f: K, v: BusinessEntry[K]) => {
    const arr = [...d.businesses]; arr[i] = { ...arr[i], [f]: v }; u("businesses", arr);
  };

  return (
    <div className="space-y-5">
      <Field label="¿Ha fundado o cofundado alguna empresa o emprendimiento?" required>
        <YesNo value={d.hasOwnBusinesses} onChange={v => u("hasOwnBusinesses", v)}
          yesLabel="Sí, he fundado empresas" noLabel="No"/>
      </Field>

      {d.hasOwnBusinesses === true && (
        <div className="space-y-4">
          {d.businesses.map((b, i) => (
            <Card key={b.id} label="Empresa" index={i} onRemove={d.businesses.length > 1 ? () => removeBusiness(i) : undefined}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre de la empresa">
                  <TextInput value={b.name} onChange={v => upd(i,"name",v)} placeholder="Mi Empresa SAS"/>
                </Field>
                <Field label="País">
                  <TextInput value={b.country} onChange={v => upd(i,"country",v)} placeholder="Colombia"/>
                </Field>
                <Field label="Año de fundación">
                  <TextInput type="number" value={b.foundedYear} onChange={v => upd(i,"foundedYear",v)} placeholder="2018"/>
                </Field>
                <Field label="Sector / Industria">
                  <TextInput value={b.industry} onChange={v => upd(i,"industry",v)} placeholder="Tecnología, Salud, Arte..."/>
                </Field>
                <Field label="Tu rol">
                  <Select value={b.role} onChange={v => upd(i,"role",v)}>
                    <option value="">Selecciona...</option>
                    <option value="fundador">Fundador/a</option>
                    <option value="cofundador">Cofundador/a</option>
                    <option value="ceo">CEO</option>
                    <option value="cto">CTO</option>
                    <option value="otro">Otro</option>
                  </Select>
                </Field>
                <Field label="Número aproximado de empleados">
                  <TextInput type="number" value={b.employeeCount} onChange={v => upd(i,"employeeCount",v)} placeholder="10"/>
                </Field>
                <Field label="¿Sigue activa?">
                  <YesNo value={b.isActive} onChange={v => upd(i,"isActive",v)} yesLabel="Sí, activa" noLabel="Ya no"/>
                </Field>
                <Field label="Sitio web" hint="Opcional">
                  <TextInput value={b.website} onChange={v => upd(i,"website",v)} placeholder="https://miempresa.com"/>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Descripción del impacto o logros de la empresa">
                  <Textarea value={b.description} onChange={v => upd(i,"description",v)}
                    placeholder="Clientes atendidos, revenue generado, impacto en la industria..." rows={3}/>
                </Field>
              </div>
            </Card>
          ))}
          <AddBtn label="Agregar empresa" onClick={addBusiness}/>
        </div>
      )}
    </div>
  );
}
