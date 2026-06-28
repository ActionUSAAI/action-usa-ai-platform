"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, ChevronLeft, CheckCircle } from "lucide-react";

type View = "login" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Login ───────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !data.user) {
      setError("Correo o contraseña incorrectos. Por favor intenta de nuevo.");
      setLoading(false);
      return;
    }

    // Role-based redirect: authoritative source is the profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role;
    if (role === "admin" || role === "supervisor" || role === "agent") {
      router.push("/dashboard");
    } else {
      router.push("/client/dashboard");
    }
    router.refresh();
  }

  // ── Forgot password ─────────────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      forgotEmail,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/setup-account`,
      }
    );

    setLoading(false);
    if (resetErr) {
      setError("No se pudo enviar el email. Verifica que el correo sea correcto.");
      return;
    }
    setView("forgot-sent");
  }

  // ── Forgot password sent ────────────────────────────────────────────────────
  if (view === "forgot-sent") {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle size={36} className="text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Email enviado</h2>
        <p className="text-sm text-gray-500">
          Revisa tu bandeja de entrada en{" "}
          <span className="font-medium text-gray-700">{forgotEmail}</span> y haz clic en
          el enlace para crear una nueva contraseña.
        </p>
        <button
          onClick={() => { setView("login"); setForgotEmail(""); }}
          className="text-sm text-brand-blue hover:underline"
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  // ── Forgot password form ────────────────────────────────────────────────────
  if (view === "forgot") {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl">
        <button
          onClick={() => { setView("login"); setError(null); }}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={15} /> Volver
        </button>
        <h2 className="mb-1 text-xl font-bold text-gray-900">Recuperar contraseña</h2>
        <p className="mb-6 text-sm text-gray-500">
          Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 mt-3.5" />
            <Input
              label="Correo electrónico"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              autoComplete="email"
              className="pl-9"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading} size="lg">
            Enviar enlace de recuperación
          </Button>
        </form>
      </div>
    );
  }

  // ── Login form ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h2 className="mb-1 text-xl font-bold text-gray-900">Iniciar sesión</h2>
      <p className="mb-6 text-sm text-gray-500">Ingresa tus credenciales para continuar</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 mt-3.5" />
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            autoComplete="email"
            className="pl-9"
          />
        </div>

        <div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 mt-3.5" />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="pl-9"
            />
          </div>
          <div className="mt-1 text-right">
            <button
              type="button"
              onClick={() => { setView("forgot"); setForgotEmail(email); setError(null); }}
              className="text-xs text-brand-blue hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading} size="lg">
          Iniciar sesión
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/register"
          className="text-sm text-brand-blue hover:text-brand-blue-dark hover:underline"
        >
          ¿No tienes cuenta? Regístrate
        </Link>
      </div>
    </div>
  );
}
