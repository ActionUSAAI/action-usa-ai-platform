import { createClient } from "@/lib/supabase/server";
import { BarChart3 } from "lucide-react";
import type { CaseStatus, CaseType } from "@/types/database";

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

const statusLabels: Record<CaseStatus, string> = {
  nuevo: "Nuevo",
  en_progreso: "En Progreso",
  pendiente_documentos: "Pendiente Docs",
  en_revision: "En Revisión",
  aprobado: "Aprobado",
  denegado: "Denegado",
  cerrado: "Cerrado",
  archivado: "Archivado",
};

const statusColors: Record<CaseStatus, string> = {
  nuevo: "bg-blue-400",
  en_progreso: "bg-brand-blue",
  pendiente_documentos: "bg-amber-400",
  en_revision: "bg-yellow-400",
  aprobado: "bg-green-500",
  denegado: "bg-brand-red",
  cerrado: "bg-gray-400",
  archivado: "bg-gray-300",
};

export default async function ReportesPage() {
  const supabase = createClient();

  const [
    { data: casesByStatus },
    { data: casesByType },
    { data: casesByAgent },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from("cases").select("status"),
    supabase.from("cases").select("case_type"),
    supabase
      .from("cases")
      .select(`assigned_agent_id, profiles!cases_assigned_agent_id_fkey(full_name)`)
      .not("assigned_agent_id", "is", null),
    supabase
      .from("payments")
      .select("amount, payment_date, description")
      .order("payment_date", { ascending: false })
      .limit(10),
  ]);

  // Calcular estadísticas
  const statusCounts = (casesByStatus ?? []).reduce<Record<string, number>>((acc, c: any) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const typeCounts = (casesByType ?? []).reduce<Record<string, number>>((acc, c: any) => {
    acc[c.case_type] = (acc[c.case_type] ?? 0) + 1;
    return acc;
  }, {});

  const agentCounts = (casesByAgent ?? []).reduce<Record<string, { name: string; count: number }>>((acc, c: any) => {
    const id = c.assigned_agent_id;
    const name = c.profiles?.full_name ?? "Desconocido";
    if (!acc[id]) acc[id] = { name, count: 0 };
    acc[id].count++;
    return acc;
  }, {});

  const totalCases = casesByStatus?.length ?? 0;
  const totalRevenue = (recentPayments ?? []).reduce((sum, p: any) => sum + (p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reportes</h2>
        <p className="text-sm text-gray-500 mt-1">Estadísticas y métricas del sistema</p>
      </div>

      {/* Casos por Estado */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Casos por Estado</h3>
        {totalCases === 0 ? (
          <div className="text-center py-8">
            <BarChart3 size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No hay datos disponibles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(statusCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = Math.round((count / totalCases) * 100);
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{statusLabels[status as CaseStatus] ?? status}</span>
                      <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${statusColors[status as CaseStatus] ?? "bg-gray-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Casos por Tipo */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Casos por Tipo</h3>
          {Object.keys(typeCounts).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(typeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{caseTypeLabels[type as CaseType] ?? type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-brand-blue"
                          style={{ width: `${Math.round((count / totalCases) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Productividad por Agente */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Casos por Agente</h3>
          {Object.keys(agentCounts).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.values(agentCounts)
                .sort((a, b) => b.count - a.count)
                .map(({ name, count }) => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold">
                        {name[0]}
                      </div>
                      <span className="text-sm text-gray-700">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Pagos recientes */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Pagos Recientes</h3>
          <span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
            Total: ${totalRevenue.toLocaleString("es")} USD
          </span>
        </div>
        {!recentPayments || recentPayments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No hay pagos registrados</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentPayments.map((p: any, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-900">{p.description ?? "Pago de honorarios"}</p>
                  <p className="text-xs text-gray-500">{new Date(p.payment_date).toLocaleDateString("es")}</p>
                </div>
                <span className="text-sm font-semibold text-green-700">${p.amount.toLocaleString("es")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
