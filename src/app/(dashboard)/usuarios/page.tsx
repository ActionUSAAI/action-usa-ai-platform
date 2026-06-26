import { createClient } from "@/lib/supabase/server";
import { UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  agent: "Agente",
  client: "Cliente",
};

const roleVariants: Record<UserRole, "danger" | "warning" | "info" | "gray"> = {
  admin: "danger",
  supervisor: "warning",
  agent: "info",
  client: "gray",
};

export default async function UsuariosPage() {
  const supabase = createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at, phone")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios del Sistema</h2>
          <p className="text-sm text-gray-500 mt-1">{users?.length ?? 0} usuarios registrados</p>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {!users || users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <UserCog size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay usuarios</h3>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Correo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-white text-xs font-bold">
                        {user.full_name?.[0] ?? user.email?.[0] ?? "?"}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{user.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{user.phone ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleVariants[user.role as UserRole]}>
                      {roleLabels[user.role as UserRole]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString("es")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
