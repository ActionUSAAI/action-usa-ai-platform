"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function parseSupabaseError(error: unknown): string {
  if (!error) return "Error desconocido.";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (typeof e.msg === "string" && e.msg.trim()) return e.msg;
    if (typeof e.error_description === "string") return e.error_description;
    if (typeof e.code === "number" || typeof e.code === "string") {
      const code = String(e.code);
      if (code === "422") return "Este correo ya está registrado. Intenta iniciar sesión.";
      if (code === "429") return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
      if (code === "500") return "Error del servidor. Intenta de nuevo en unos segundos.";
    }
  }
  return "Ocurrió un error al crear la cuenta. Intenta de nuevo.";
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (formData.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: { full_name: formData.fullName.trim() },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) {
        setError(parseSupabaseError(authError));
        setLoading(false);
        return;
      }

      // Supabase devuelve user sin session cuando hay confirmación de email pendiente
      if (data?.user && !data?.session) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Si hay session directamente (sin confirmación de email requerida)
      if (data?.session) {
        window.location.href = "/dashboard";
        return;
      }

      // Caso: signUp silencioso (email ya existe no confirmado)
      setSuccess(true);
      setLoading(false);

    } catch (err: unknown) {
      setError(parseSupabaseError(err));
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Revisa tu correo</h2>
        <p className="mt-2 text-sm text-gray-500">
          Enviamos un enlace de confirmación a <strong>{formData.email}</strong>.
          Ábrelo para activar tu cuenta.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <Link href="/login" className="mt-5 block text-sm text-brand-blue hover:underline">
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h2 className="mb-1 text-xl font-bold text-gray-900">Crear cuenta</h2>
      <p className="mb-6 text-sm text-gray-500">Completa los datos para registrarte</p>

      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          label="Nombre completo"
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Juan García"
          required
        />
        <Input
          label="Correo electrónico"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="tu@correo.com"
          required
          autoComplete="email"
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
          hint="Mínimo 8 caracteres"
        />
        <Input
          label="Confirmar contraseña"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Repite tu contraseña"
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading} size="lg">
          Crear cuenta
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-brand-blue hover:text-brand-blue-dark hover:underline"
        >
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      </div>
    </div>
  );
}
