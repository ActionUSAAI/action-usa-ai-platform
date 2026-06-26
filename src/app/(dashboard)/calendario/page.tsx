import { createClient } from "@/lib/supabase/server";
import { Calendar, Video, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types/database";

const statusLabels: Record<AppointmentStatus, string> = {
  programada: "Programada",
  completada: "Completada",
  cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

const statusVariants: Record<AppointmentStatus, "info" | "success" | "danger" | "warning"> = {
  programada: "info",
  completada: "success",
  cancelada: "danger",
  reprogramada: "warning",
};

export default async function CalendarioPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: upcoming } = await supabase
    .from("appointments")
    .select(`
      id, title, description, scheduled_at, duration_minutes, status,
      location, is_virtual, meeting_link,
      clients(first_name, last_name),
      cases(case_number),
      profiles!appointments_agent_id_fkey(full_name)
    `)
    .gte("scheduled_at", now)
    .eq("status", "programada")
    .order("scheduled_at", { ascending: true })
    .limit(20);

  const { data: past } = await supabase
    .from("appointments")
    .select(`
      id, title, scheduled_at, status, duration_minutes,
      clients(first_name, last_name)
    `)
    .lt("scheduled_at", now)
    .order("scheduled_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Calendario</h2>
        <p className="text-sm text-gray-500 mt-1">Citas y audiencias programadas</p>
      </div>

      {/* Próximas citas */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">
          Próximas Citas
          <span className="ml-2 text-xs bg-brand-blue/10 text-brand-blue rounded-full px-2 py-0.5">
            {upcoming?.length ?? 0}
          </span>
        </h3>

        {!upcoming || upcoming.length === 0 ? (
          <div className="text-center py-10">
            <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No hay citas programadas</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((appt: any) => {
              const date = new Date(appt.scheduled_at);
              const endTime = new Date(date.getTime() + appt.duration_minutes * 60000);

              return (
                <div key={appt.id} className="flex gap-4 rounded-xl border border-gray-100 p-4 hover:border-brand-blue/30 transition-colors">
                  {/* Fecha */}
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-blue text-white">
                    <span className="text-xs font-medium leading-none">
                      {date.toLocaleString("es", { month: "short" }).toUpperCase()}
                    </span>
                    <span className="text-xl font-bold leading-tight">{date.getDate()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{appt.title}</p>
                      <Badge variant="info">Programada</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {appt.clients?.first_name} {appt.clients?.last_name}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {endTime.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {appt.is_virtual ? (
                        <span className="flex items-center gap-1"><Video size={10} />Virtual</span>
                      ) : appt.location ? (
                        <span className="flex items-center gap-1"><MapPin size={10} />{appt.location}</span>
                      ) : null}
                    </div>
                    {appt.profiles?.full_name && (
                      <p className="text-xs text-gray-400 mt-1">Agente: {appt.profiles.full_name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Citas recientes */}
      {past && past.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Citas Recientes</h3>
          <div className="space-y-2">
            {past.map((appt: any) => (
              <div key={appt.id} className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{appt.title}</p>
                  <p className="text-xs text-gray-500">
                    {appt.clients?.first_name} {appt.clients?.last_name} ·{" "}
                    {new Date(appt.scheduled_at).toLocaleDateString("es")}
                  </p>
                </div>
                <Badge variant={statusVariants[appt.status as AppointmentStatus]}>
                  {statusLabels[appt.status as AppointmentStatus]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
