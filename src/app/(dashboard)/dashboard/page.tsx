import { createClient } from "@/lib/supabase/server";
import {
  FolderOpen,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Badge, statusBadgeVariant, statusLabels, priorityBadgeVariant, priorityLabels } from "@/components/ui/badge";
import Link from "next/link";
import type { CaseStatus, Priority } from "@/types/database";

async function getDashboardStats() {
  const supabase = createClient();

  const [
    { count: totalCases },
    { count: totalClients },
    { count: activeCases },
    { count: pendingDocs },
    { count: urgentCases },
    { data: recentCases },
    { data: upcomingAppointments },
  ] = await Promise.all([
    supabase.from("cases").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("cases").select("*", { count: "exact", head: true }).in("status", ["nuevo", "en_progreso", "en_revision"]),
    supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "pendiente_documentos"),
    supabase.from("cases").select("*", { count: "exact", head: true }).eq("priority", "urgente").not("status", "in", '("cerrado","archivado")'),
    supabase.from("cases")
      .select(`
        id, case_number, title, status, priority, created_at,
        clients(first_name, last_name)
      `)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("appointments")
      .select(`
        id, title, scheduled_at, is_virtual,
        clients(first_name, last_name)
      `)
      .gte("scheduled_at", new Date().toISOString())
      .eq("status", "programada")
      .order("scheduled_at", { ascending: true })
      .limit(5),
  ]);

  return {
    totalCases: totalCases ?? 0,
    totalClients: totalClients ?? 0,
    activeCases: activeCases ?? 0,
    pendingDocs: pendingDocs ?? 0,
    urgentCases: urgentCases ?? 0,
    recentCases: recentCases ?? [],
    upcomingAppointments: upcomingAppointments ?? [],
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: "Total Casos",
      value: stats.totalCases,
      icon: FolderOpen,
      color: "bg-brand-blue",
      href: "/cases",
    },
    {
      label: "Clientes Activos",
      value: stats.totalClients,
      icon: Users,
      color: "bg-emerald-600",
      href: "/clientes",
    },
    {
      label: "Casos Activos",
      value: stats.activeCases,
      icon: TrendingUp,
      color: "bg-blue-500",
      href: "/cases?status=en_progreso",
    },
    {
      label: "Pendiente Docs",
      value: stats.pendingDocs,
      icon: Clock,
      color: "bg-amber-500",
      href: "/cases?status=pendiente_documentos",
    },
    {
      label: "Casos Urgentes",
      value: stats.urgentCases,
      icon: AlertTriangle,
      color: "bg-brand-red",
      href: "/cases?priority=urgente",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Resumen general del sistema</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Casos recientes */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Casos Recientes</h3>
            <Link href="/cases" className="text-xs text-brand-blue hover:underline">
              Ver todos
            </Link>
          </div>

          {stats.recentCases.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No hay casos registrados</p>
          ) : (
            <div className="space-y-3">
              {stats.recentCases.map((caso: any) => (
                <Link
                  key={caso.id}
                  href={`/cases/${caso.id}`}
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{caso.case_number}</span>
                      <Badge variant={priorityBadgeVariant[caso.priority as Priority]}>
                        {priorityLabels[caso.priority as Priority]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{caso.title}</p>
                    <p className="text-xs text-gray-500">
                      {caso.clients?.first_name} {caso.clients?.last_name}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant[caso.status as CaseStatus]}>
                    {statusLabels[caso.status as CaseStatus]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Próximas citas */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Próximas Citas</h3>
            <Link href="/calendario" className="text-xs text-brand-blue hover:underline">
              Ver calendario
            </Link>
          </div>

          {stats.upcomingAppointments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No hay citas programadas</p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingAppointments.map((appt: any) => {
                const date = new Date(appt.scheduled_at);
                return (
                  <div key={appt.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                      <span className="text-xs font-bold leading-none">
                        {date.getDate()}
                      </span>
                      <span className="text-xs leading-none">
                        {date.toLocaleString("es", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{appt.title}</p>
                      <p className="text-xs text-gray-500">
                        {appt.clients?.first_name} {appt.clients?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        {appt.is_virtual && " · Virtual"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
