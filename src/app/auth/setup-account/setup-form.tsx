"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle, AlertCircle, Lock, User, Mail } from "lucide-react";

export function SetupForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message || "Error al crear la contraseña. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    setDone(true);
    // Already authenticated — go straight to dashboard, no login step needed
    setTimeout(() => router.push("/client/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="ACTION USA AI"
            width={240}
            height={120}
            className="mx-auto h-[100px] w-auto"
            priority
          />
          <p className="mt-3 text-sm text-blue-200">Portal del Cliente</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {done ? (
            <div className="py-4 text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle size={40} className="text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900">¡Cuenta creada!</h2>
              <p className="text-sm text-gray-500">Entrando a tu portal...</p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-xl font-bold text-gray-900">Crea tu contraseña</h2>
              <p className="mb-6 text-sm text-gray-500">
                Bienvenido(a) a ACTION USA AI. Crea una contraseña para acceder a tu portal.
              </p>

              {/* Pre-loaded user info (read-only) */}
              <div className="mb-5 space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <User size={15} className="shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Nombre</p>
                    <p className="truncate text-sm font-medium text-gray-800">{name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <Mail size={15} className="shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Correo electrónico</p>
                    <p className="truncate text-sm font-medium text-gray-800">{email}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Contraseña <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Confirmar contraseña <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repite tu contraseña"
                      required
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle size={15} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60 transition-colors shadow-sm"
                >
                  {loading ? "Creando cuenta..." : "Crear mi cuenta →"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-blue-300">
          ¿Problemas?{" "}
          <a href="mailto:actionusaaillc@gmail.com" className="hover:text-white underline">
            actionusaaillc@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
