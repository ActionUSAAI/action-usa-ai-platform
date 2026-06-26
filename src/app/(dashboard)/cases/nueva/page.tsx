"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { CaseType, Priority } from "@/types/database";

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "asilo", label: "Asilo" },
  { value: "visa_trabajo", label: "Visa de Trabajo" },
  { value: "residencia", label: "Residencia Permanente" },
  { value: "ciudadania", label: "Ciudadanía" },
  { value: "daca", label: "DACA" },
  { value: "deportacion", label: "Defensa de Deportación" },
  { value: "visa_familiar", label: "Visa Familiar" },
  { value: "otro", label: "Otro" },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export default function NuevoCasoPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>([]);

  const [form, setForm] = useState({
    client_id: "",
    assigned_agent_id: "",
    case_type: "asilo" as CaseType,
    priority: "normal" as Priority,
    title: "",
    description: "",
    uscis_receipt_number: "",
    filing_date: "",
    deadline: "",
    fee_amount: "",
  });

  useEffect(() => {
    async function load() {
      const [{ data: clientsData }, { data: agentsData }] = await Promise.all([
        supabase.from("clients").select("id, first_name, last_name").eq("is_active", true).order("last_name"),
        supabase.from("profiles").select("id, full_name").eq("is_active", true).in("role", ["admin", "supervisor", "agent"]),
      ]);
      setClients(clientsData ?? []);
      setAgents(agentsData ?? []);
    }
    load();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.from("cases").insert({
      client_id: form.client_id,
      assigned_agent_id: form.assigned_agent_id || null,
      case_type: form.case_type,
      priority: form.priority,
      title: form.title,
      description: form.description || null,
      uscis_receipt_number: form.uscis_receipt_number || null,
      filing_date: form.filing_date || null,
      deadline: form.deadline || null,
      fee_amount: form.fee_amount ? parseFloat(form.fee_amount) : null,
    }).select().single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push(`/cases/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            Volver
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Caso</h2>
          <p className="text-sm text-gray-500">Completa la información del caso</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
        {/* Cliente */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Cliente <span className="text-brand-red">*</span>
          </label>
          <select
            name="client_id"
            value={form.client_id}
            onChange={handleChange}
            required
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            <option value="">Seleccionar cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.last_name}, {c.first_name}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de caso */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Tipo de Caso <span className="text-brand-red">*</span>
            </label>
            <select
              name="case_type"
              value={form.case_type}
              onChange={handleChange}
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
              {CASE_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Prioridad</label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
              {PRIORITIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Título */}
        <Input
          label="Título del caso"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Ej: Solicitud de Asilo - Juan García"
          required
        />

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Descripción detallada del caso..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
          />
        </div>

        {/* Agente asignado */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Agente asignado</label>
          <select
            name="assigned_agent_id"
            value={form.assigned_agent_id}
            onChange={handleChange}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            <option value="">Sin asignar</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name ?? "—"}</option>
            ))}
          </select>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fecha de presentación"
            name="filing_date"
            type="date"
            value={form.filing_date}
            onChange={handleChange}
          />
          <Input
            label="Fecha límite"
            name="deadline"
            type="date"
            value={form.deadline}
            onChange={handleChange}
          />
        </div>

        {/* Número USCIS y monto */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Número de recibo USCIS"
            name="uscis_receipt_number"
            value={form.uscis_receipt_number}
            onChange={handleChange}
            placeholder="MSC-XX-000-00000"
          />
          <Input
            label="Monto de honorarios (USD)"
            name="fee_amount"
            type="number"
            min="0"
            step="0.01"
            value={form.fee_amount}
            onChange={handleChange}
            placeholder="0.00"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/cases">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button type="submit" loading={loading}>
            Crear Caso
          </Button>
        </div>
      </form>
    </div>
  );
}
