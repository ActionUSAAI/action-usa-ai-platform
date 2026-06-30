"use client";

import { useState } from "react";
import { Send, X, CheckCircle, ExternalLink } from "lucide-react";

const CASE_OPTIONS = [
  { value: "o1a_eb1a",       label: "Talento extraordinario — O-1A / EB-1A" },
  { value: "o1b",            label: "Talento extraordinario — O-1B" },
  { value: "por_determinar", label: "Por determinar" },
] as const;

type CaseOptionValue = typeof CASE_OPTIONS[number]["value"];

interface Result {
  case_id:       string;
  case_number:   string;
  invitation_id: string;
  expires_at:    string;
  email_warning?: string;
}

export function NuevaInvitacionButton() {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState({ full_name: "", email: "", phone: "", case_type: "o1a_eb1a" as CaseOptionValue });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<Result | null>(null);

  function resetForm() {
    setForm({ full_name: "", email: "", phone: "", case_type: "o1a_eb1a" });
    setError(null);
    setResult(null);
    setLoading(false);
  }

  function close() {
    setOpen(false);
    setTimeout(resetForm, 250);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invitations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email:     form.email.trim(),
          phone:     form.phone.trim() || undefined,
          case_type: form.case_type,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al crear la invitación.");
        return;
      }

      setResult(data as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-[#1B2B5E] px-4 py-2 text-sm font-semibold text-[#C9A84C] hover:bg-[#121e42] transition-colors"
      >
        <Send size={14} />
        Nueva invitación
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Nueva invitación</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Crea el caso y envía el formulario AUCIS al cliente
                </p>
              </div>
              <button
                onClick={close}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {result ? (
              /* ── Success state ── */
              <div className="px-6 py-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle size={28} className="text-green-600" />
                  </div>
                </div>

                <div>
                  <p className="text-base font-semibold text-gray-900">¡Invitación enviada!</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Caso{" "}
                    <span className="font-mono font-semibold text-[#1B2B5E]">{result.case_number}</span>{" "}
                    creado · invitación enviada a{" "}
                    <span className="font-medium">{form.email}</span>
                  </p>
                  {result.email_warning && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      El caso fue creado pero el email falló: {result.email_warning}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <a
                    href={`/cases/${result.case_id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1B2B5E] px-4 py-2.5 text-sm font-semibold text-[#1B2B5E] hover:bg-[#1B2B5E]/5 transition-colors"
                  >
                    <ExternalLink size={13} />
                    Ver caso
                  </a>
                  <button
                    onClick={resetForm}
                    className="flex-1 rounded-lg bg-[#1B2B5E] px-4 py-2.5 text-sm font-semibold text-[#C9A84C] hover:bg-[#121e42] transition-colors"
                  >
                    Nueva invitación
                  </button>
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <form onSubmit={submit} className="px-6 py-5 space-y-4">

                {/* Nombre completo */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Ej. María González Torres"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-[#1B2B5E] focus:outline-none focus:ring-1 focus:ring-[#1B2B5E]"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="cliente@ejemplo.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-[#1B2B5E] focus:outline-none focus:ring-1 focus:ring-[#1B2B5E]"
                  />
                </div>

                {/* Tipo de caso */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Tipo de caso tentativo
                  </label>
                  <select
                    value={form.case_type}
                    onChange={e => setForm(f => ({ ...f, case_type: e.target.value as CaseOptionValue }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#1B2B5E] focus:outline-none focus:ring-1 focus:ring-[#1B2B5E]"
                  >
                    {CASE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Teléfono */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Teléfono / WhatsApp{" "}
                    <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (305) 000-0000"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-[#1B2B5E] focus:outline-none focus:ring-1 focus:ring-[#1B2B5E]"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B2B5E] px-4 py-3 text-sm font-semibold text-[#C9A84C] hover:bg-[#121e42] disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Creando caso y enviando...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Crear caso y enviar invitación
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Esto crea el caso, el cliente y envía el correo de invitación automáticamente.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
