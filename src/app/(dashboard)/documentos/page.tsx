import { createClient } from "@/lib/supabase/server";
import { FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types/database";

const statusLabels: Record<DocumentStatus, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  verificado: "Verificado",
  rechazado: "Rechazado",
};

const statusVariants: Record<DocumentStatus, "gray" | "info" | "success" | "danger"> = {
  pendiente: "gray",
  recibido: "info",
  verificado: "success",
  rechazado: "danger",
};

export default async function DocumentosPage() {
  const supabase = createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select(`
      id, name, description, status, mime_type, file_size, created_at, expires_at,
      clients(first_name, last_name),
      cases(case_number, title)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documentos</h2>
          <p className="text-sm text-gray-500 mt-1">{documents?.length ?? 0} documentos en el sistema</p>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-4 gap-4">
        {(["pendiente", "recibido", "verificado", "rechazado"] as DocumentStatus[]).map((status) => {
          const count = documents?.filter((d: any) => d.status === status).length ?? 0;
          return (
            <div key={status} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <Badge variant={statusVariants[status]} className="mt-1">{statusLabels[status]}</Badge>
            </div>
          );
        })}
      </div>

      {/* Lista de documentos */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {!documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Upload size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay documentos</h3>
            <p className="mt-1 text-sm text-gray-500">Los documentos aparecerán aquí cuando se carguen en los casos.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Caso</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vence</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10">
                        <FileText size={14} className="text-brand-blue" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {doc.clients?.first_name} {doc.clients?.last_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-500">{doc.cases?.case_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariants[doc.status as DocumentStatus]}>
                      {statusLabels[doc.status as DocumentStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {doc.expires_at ? (
                      <span className={`text-sm ${new Date(doc.expires_at) < new Date() ? "text-red-600" : "text-gray-600"}`}>
                        {new Date(doc.expires_at).toLocaleDateString("es")}
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{new Date(doc.created_at).toLocaleDateString("es")}</span>
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
