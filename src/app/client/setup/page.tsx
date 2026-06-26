"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react";
import Image from "next/image";

export default function ClientSetupPage() {
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
      setError(updateErr.message || "Error al establecer la contraseña. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/client/dashboard"), 2000);
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle size={40} className="text-green-600" />
            </div>
          </div>
          <p className="text-lg font-semibold text-gray-800">¡Contraseña creada!</p>
          <p className="text-sm text-gray-500">Redirigiendo a tu portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6">

        {/* Welcome */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">¡Bienvenido(a) a tu portal!</h1>
          <p className="text-sm text-gray-500">
            Crea una contraseña para acceder a tu expediente en ACTION USA AI.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Contraseña <span className="text-brand-red">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Confirmar contraseña <span className="text-brand-red">*</span>
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60 transition-colors"
            >
              {loading ? "Guardando..." : "Crear contraseña y acceder →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          ¿Problemas? Escríbenos a{" "}
          <a href="mailto:actionusaaillc@gmail.com" className="text-brand-blue hover:underline">
            actionusaaillc@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
