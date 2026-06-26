import { createClient } from "@/lib/supabase/server";
import { Settings, User } from "lucide-react";

export default async function ConfiguracionPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
        <p className="text-sm text-gray-500 mt-1">Gestiona tu cuenta y preferencias</p>
      </div>

      {/* Perfil */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-5">
          <User size={18} className="text-brand-blue" />
          Perfil
        </h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue text-white text-xl font-bold">
            {profile?.full_name?.[0] ?? profile?.email?.[0] ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile?.full_name ?? "—"}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs bg-brand-blue/10 text-brand-blue rounded-full px-2 py-0.5 capitalize">
              {profile?.role}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Nombre completo</p>
            <p className="font-medium text-gray-900 mt-0.5">{profile?.full_name ?? "No configurado"}</p>
          </div>
          <div>
            <p className="text-gray-500">Teléfono</p>
            <p className="font-medium text-gray-900 mt-0.5">{profile?.phone ?? "No configurado"}</p>
          </div>
          <div>
            <p className="text-gray-500">Estado</p>
            <p className={`font-medium mt-0.5 ${profile?.is_active ? "text-green-700" : "text-gray-500"}`}>
              {profile?.is_active ? "Activo" : "Inactivo"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Miembro desde</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Información del sistema */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
          <Settings size={18} className="text-brand-blue" />
          Información del Sistema
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Sistema</span>
            <span className="font-medium text-gray-900">ACTION USA AI v1.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Dominio</span>
            <span className="font-medium text-gray-900">actionusaai.com</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Stack</span>
            <span className="font-medium text-gray-900">Next.js 14 + Supabase</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Colores corporativos</span>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-brand-blue border border-gray-200" />
              <span className="h-4 w-4 rounded-full bg-brand-red border border-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
