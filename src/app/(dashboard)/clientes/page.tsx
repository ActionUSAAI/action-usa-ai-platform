import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ClientesPage() {
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select(`
      id, first_name, last_name, email, phone, country_of_origin,
      preferred_language, is_active, created_at,
      profiles!clients_assigned_agent_id_fkey(full_name)
    `)
    .order("last_name", { ascending: true })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500 mt-1">{clients?.length ?? 0} clientes registrados</p>
        </div>
        <Link href="/clientes/nuevo">
          <Button>
            <UserPlus size={16} />
            Nuevo Cliente
          </Button>
        </Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {!clients || clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <UserPlus size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay clientes</h3>
            <p className="mt-1 text-sm text-gray-500">Agrega el primer cliente al sistema.</p>
            <Link href="/clientes/nuevo" className="mt-4">
              <Button size="sm">
                <Plus size={14} />
                Nuevo Cliente
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">País de Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Agente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map((client: any) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${client.id}`} className="flex items-center gap-3 group">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue text-sm font-bold">
                          {client.first_name?.[0]}{client.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-brand-blue">
                            {client.last_name}, {client.first_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Desde {new Date(client.created_at).toLocaleDateString("es")}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{client.email ?? "—"}</p>
                      <p className="text-xs text-gray-500">{client.phone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{client.country_of_origin ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">
                        {(client.profiles as any)?.full_name ?? "Sin asignar"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          client.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {client.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
