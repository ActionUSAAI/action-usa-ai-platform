import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant, statusLabels, priorityBadgeVariant, priorityLabels } from "@/components/ui/badge";
import type { CaseStatus, CaseType, Priority } from "@/types/database";
import { NuevaInvitacionButton } from "./nueva-invitacion";

const caseTypeLabels: Record<CaseType, string> = {
  asilo: "Asilo",
  visa_trabajo: "Visa Trabajo",
  residencia: "Residencia",
  ciudadania: "Ciudadanía",
  daca: "DACA",
  deportacion: "Deportación",
  visa_familiar: "Visa Familiar",
  otro: "Otro",
};

interface CasesPageProps {
  searchParams: { status?: string; priority?: string; type?: string; q?: string };
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const supabase = createClient();

  let query = supabase
    .from("cases")
    .select(`
      id, case_number, title, status, priority, case_type, created_at, deadline,
      clients(first_name, last_name),
      profiles!cases_assigned_agent_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }
  if (searchParams.priority) {
    query = query.eq("priority", searchParams.priority);
  }
  if (searchParams.type) {
    query = query.eq("case_type", searchParams.type);
  }

  const { data: cases } = await query.limit(100);

  const statusOptions: CaseStatus[] = [
    "nuevo", "en_progreso", "pendiente_documentos", "en_revision",
    "aprobado", "denegado", "cerrado",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Casos</h2>
          <p className="text-sm text-gray-500 mt-1">{cases?.length ?? 0} casos encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <NuevaInvitacionButton />
          <Link href="/cases/nueva">
            <Button variant="outline">
              <Plus size={16} />
              Nuevo Caso
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/cases"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            !searchParams.status
              ? "bg-brand-blue text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Todos
        </Link>
        {statusOptions.map((status) => (
          <Link
            key={status}
            href={`/cases?status=${status}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              searchParams.status === status
                ? "bg-brand-blue text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {statusLabels[status]}
          </Link>
        ))}
      </div>

      {/* Tabla de casos */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {!cases || cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Search size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay casos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchParams.status
                ? "No hay casos con este estado."
                : "Crea el primer caso para comenzar."}
            </p>
            <Link href="/cases/nueva" className="mt-4">
              <Button size="sm">
                <Plus size={14} />
                Nuevo Caso
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Número
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Título / Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Prioridad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Agente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Fecha límite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map((caso: any) => (
                  <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${caso.id}`}
                        className="font-mono text-xs text-brand-blue hover:underline"
                      >
                        {caso.case_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/cases/${caso.id}`} className="group">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-blue">
                          {caso.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {caso.clients?.first_name} {caso.clients?.last_name}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">
                        {caseTypeLabels[caso.case_type as CaseType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant[caso.status as CaseStatus]}>
                        {statusLabels[caso.status as CaseStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityBadgeVariant[caso.priority as Priority]}>
                        {priorityLabels[caso.priority as Priority]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {caso.profiles?.full_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {caso.deadline ? (
                        <span
                          className={`text-sm ${
                            new Date(caso.deadline) < new Date()
                              ? "text-red-600 font-medium"
                              : "text-gray-600"
                          }`}
                        >
                          {new Date(caso.deadline).toLocaleDateString("es")}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
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
