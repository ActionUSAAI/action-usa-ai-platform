"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export default function NuevoClientePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    country_of_origin: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    alien_number: "",
    ssn_last4: "",
    preferred_language: "es",
    notes: "",
    assigned_agent_id: "",
  });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .in("role", ["admin", "supervisor", "agent"])
      .then(({ data }) => setAgents(data ?? []));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.from("clients").insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      country_of_origin: form.country_of_origin || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      alien_number: form.alien_number || null,
      ssn_last4: form.ssn_last4 || null,
      preferred_language: form.preferred_language,
      notes: form.notes || null,
      assigned_agent_id: form.assigned_agent_id || null,
    }).select().single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push(`/clientes/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} />Volver</Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h2>
          <p className="text-sm text-gray-500">Registra la información del cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información personal */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Información Personal</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre(s)" name="first_name" value={form.first_name} onChange={handleChange} required placeholder="Juan" />
            <Input label="Apellido(s)" name="last_name" value={form.last_name} onChange={handleChange} required placeholder="García" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Correo electrónico" name="email" type="email" value={form.email} onChange={handleChange} placeholder="juan@correo.com" />
            <Input label="Teléfono" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha de nacimiento" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />
            <Input label="País de origen" name="country_of_origin" value={form.country_of_origin} onChange={handleChange} placeholder="México" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Idioma preferido</label>
              <select name="preferred_language" value={form.preferred_language} onChange={handleChange}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="fr">Français</option>
                <option value="ht">Haitian Creole</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dirección */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Dirección</h3>
          <Input label="Dirección" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Ciudad" name="city" value={form.city} onChange={handleChange} placeholder="Miami" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Estado</label>
              <select name="state" value={form.state} onChange={handleChange}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input label="ZIP" name="zip_code" value={form.zip_code} onChange={handleChange} placeholder="33101" maxLength={10} />
          </div>
        </div>

        {/* Información migratoria */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Información Migratoria</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Número A (A-Number)" name="alien_number" value={form.alien_number} onChange={handleChange} placeholder="A000000000" />
            <Input label="Últimos 4 dígitos SSN" name="ssn_last4" value={form.ssn_last4} onChange={handleChange} placeholder="XXXX" maxLength={4} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Agente asignado</label>
            <select name="assigned_agent_id" value={form.assigned_agent_id} onChange={handleChange}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
              <option value="">Sin asignar</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? "—"}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
              placeholder="Notas adicionales sobre el cliente..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/clientes"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" loading={loading}>Crear Cliente</Button>
        </div>
      </form>
    </div>
  );
}
