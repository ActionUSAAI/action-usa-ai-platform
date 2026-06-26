import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Calendar, DollarSign, Clock } from "lucide-react";
import { Badge, statusBadgeVariant, statusLabels, priorityBadgeVariant, priorityLabels } from "@/components/ui/badge";
import type { CaseStatus, Priority } from "@/types/database";

interface CasePageProps {
  params: { id: string };
}

export default async function CaseDetailPage({ params }: CasePageProps) {
  const supabase = createClient();

  const { data: casoRaw } = await supabase
    .from("cases")
    .select(`
      *,
      clients(id, first_name, last_name, email, phone, country_of_origin, alien_number),
      profiles!cases_assigned_agent_id_fkey(id, full_name, email)
    `)
    .eq("id", params.id)
    .single();

  if (!casoRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caso = casoRaw as any;

  const [{ data: notes }, { data: documents }, { data: statusHistory }] = await Promise.all([
    supabase
      .from("case_notes")
      .select(`*, profiles(full_name)`)
      .eq("case_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("case_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("case_status_history")
      .select(`*, profiles(full_name)`)
      .eq("case_id", params.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/cases">
            <button className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-400">{caso.case_number}</span>
              <Badge variant={statusBadgeVariant[caso.status as CaseStatus]}>
                {statusLabels[caso.status as CaseStatus]}
              </Badge>
              <Badge variant={priorityBadgeVariant[caso.priority as Priority]}>
                {priorityLabels[caso.priority as Priority]}
              </Badge>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{caso.title}</h2>
            {caso.description && (
              <p className="mt-1 text-sm text-gray-500">{caso.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detalles del caso */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Información del Caso</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Tipo de caso</dt>
                <dd className="font-medium text-gray-900 mt-0.5 capitalize">{caso.case_type?.replace(/_/g, " ")}</dd>
              </div>
              {caso.uscis_receipt_number && (
                <div>
                  <dt className="text-gray-500">N° Recibo USCIS</dt>
                  <dd className="font-mono font-medium text-gray-900 mt-0.5">{caso.uscis_receipt_number}</dd>
                </div>
              )}
              {caso.filing_date && (
                <div>
                  <dt className="text-gray-500 flex items-center gap-1"><Calendar size={12} /> Fecha de presentación</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">
                    {new Date(caso.filing_date).toLocaleDateString("es")}
                  </dd>
                </div>
              )}
              {caso.deadline && (
                <div>
                  <dt className="text-gray-500 flex items-center gap-1"><Clock size={12} /> Fecha límite</dt>
                  <dd className={`font-medium mt-0.5 ${new Date(caso.deadline) < new Date() ? "text-red-600" : "text-gray-900"}`}>
                    {new Date(caso.deadline).toLocaleDateString("es")}
                  </dd>
                </div>
              )}
              {caso.fee_amount && (
                <div>
                  <dt className="text-gray-500 flex items-center gap-1"><DollarSign size={12} /> Honorarios</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">
                    ${caso.fee_amount.toLocaleString("es")} USD
                    <span className={`ml-1.5 text-xs ${caso.fee_paid ? "text-green-600" : "text-amber-600"}`}>
                      {caso.fee_paid ? "✓ Pagado" : "Pendiente"}
                    </span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Creado</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {new Date(caso.created_at).toLocaleDateString("es")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notas */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              Notas del Caso
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {notes?.length ?? 0}
              </span>
            </h3>
            {!notes || notes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No hay notas en este caso.</p>
            ) : (
              <div className="space-y-4">
                {notes.map((note: any) => (
                  <div key={note.id} className="border-l-2 border-brand-blue/30 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-900">{note.profiles?.full_name ?? "—"}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(note.created_at).toLocaleDateString("es")}
                      </span>
                      {note.is_visible_to_client && (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Visible al cliente</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={16} />
              Documentos
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {documents?.length ?? 0}
              </span>
            </h3>
            {!documents || documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No hay documentos cargados.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                    </div>
                    <Badge variant={
                      doc.status === "verificado" ? "success" :
                      doc.status === "rechazado" ? "danger" :
                      doc.status === "recibido" ? "info" : "gray"
                    }>
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar derecho */}
        <div className="space-y-6">
          {/* Info del cliente */}
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Cliente</h3>
            <Link
              href={`/clientes/${caso.clients?.id}`}
              className="group flex items-center gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-bold">
                {caso.clients?.first_name?.[0]}{caso.clients?.last_name?.[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900 group-hover:text-brand-blue transition-colors">
                  {caso.clients?.first_name} {caso.clients?.last_name}
                </p>
                {caso.clients?.email && (
                  <p className="text-xs text-gray-500">{caso.clients.email}</p>
                )}
              </div>
            </Link>
            {caso.clients?.phone && (
              <p className="mt-3 text-sm text-gray-600">📞 {caso.clients.phone}</p>
            )}
            {caso.clients?.country_of_origin && (
              <p className="text-sm text-gray-600">🌎 {caso.clients.country_of_origin}</p>
            )}
            {caso.clients?.alien_number && (
              <p className="text-sm text-gray-600">A# {caso.clients.alien_number}</p>
            )}
          </div>

          {/* Agente asignado */}
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Agente Asignado</h3>
            {caso.profiles ? (
              <div>
                <p className="font-medium text-gray-900">{caso.profiles.full_name}</p>
                <p className="text-xs text-gray-500">{caso.profiles.email}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin asignar</p>
            )}
          </div>

          {/* Historial de estado */}
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Historial de Estado</h3>
            {!statusHistory || statusHistory.length === 0 ? (
              <p className="text-sm text-gray-500">Sin cambios registrados.</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                    <div>
                      <p className="text-gray-600">
                        <span className="font-medium text-gray-900">{h.profiles?.full_name}</span>
                        {" cambió a "}
                        <span className="font-medium">{statusLabels[h.new_status as CaseStatus]}</span>
                      </p>
                      <p className="text-gray-400">{new Date(h.created_at).toLocaleDateString("es")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
