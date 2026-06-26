import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  FileText,
  MessageSquare,
  Mail,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Circle,
} from "lucide-react";

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  en_progreso: "En Progreso",
  pendiente_documentos: "Pendiente de Documentos",
  en_revision: "En Revisión",
  aprobado: "Aprobado",
  denegado: "Denegado",
  cerrado: "Cerrado",
  archivado: "Archivado",
};

const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700 border-blue-200",
  en_progreso: "bg-purple-100 text-purple-700 border-purple-200",
  pendiente_documentos: "bg-amber-100 text-amber-800 border-amber-200",
  en_revision: "bg-indigo-100 text-indigo-700 border-indigo-200",
  aprobado: "bg-green-100 text-green-700 border-green-200",
  denegado: "bg-red-100 text-red-700 border-red-200",
  cerrado: "bg-gray-100 text-gray-700 border-gray-200",
  archivado: "bg-gray-100 text-gray-500 border-gray-200",
};

const DOC_STATUS_COLOR: Record<string, string> = {
  pendiente: "text-amber-600 bg-amber-50",
  recibido: "text-blue-600 bg-blue-50",
  verificado: "text-green-600 bg-green-50",
  rechazado: "text-red-600 bg-red-50",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  verificado: "Verificado",
  rechazado: "Rechazado",
};

// ─── Case progress stages ──────────────────────────────────────────────────────
const STAGES = [
  { key: "nuevo", label: "Recibido" },
  { key: "en_progreso", label: "En proceso" },
  { key: "pendiente_documentos", label: "Documentos" },
  { key: "en_revision", label: "En revisión" },
  { key: "aprobado", label: "Aprobado" },
];

const STAGE_ORDER = ["nuevo", "en_progreso", "pendiente_documentos", "en_revision", "aprobado"];

function stageIndex(status: string) {
  const idx = STAGE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default async function ClientDashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile (full_name)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // Fetch client record
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("profile_id", user.id)
    .single();

  // Fetch cases (RLS allows client to see their own via profile_id)
  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_number, case_type, status, title, description, created_at, updated_at")
    .order("created_at", { ascending: false });

  const mainCase = cases?.[0] ?? null;

  // Fetch notes visible to client (for main case)
  let notes: { id: string; content: string; created_at: string }[] = [];
  if (mainCase) {
    const { data } = await supabase
      .from("case_notes")
      .select("id, content, created_at")
      .eq("case_id", mainCase.id)
      .eq("is_visible_to_client", true)
      .order("created_at", { ascending: false })
      .limit(5);
    notes = data || [];
  }

  // Fetch documents
  let docs: { id: string; name: string; status: string; description: string | null; created_at: string }[] = [];
  if (client) {
    const { data } = await supabase
      .from("documents")
      .select("id, name, status, description, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    docs = data || [];
  }

  const firstName = client?.first_name || profile?.full_name?.split(" ")[0] || "Cliente";
  const currentStage = mainCase ? stageIndex(mainCase.status) : 0;

  return (
    <div className="space-y-6">

      {/* Welcome + case status hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue-dark p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-blue-200 text-sm">Bienvenido(a) de vuelta,</p>
            <h1 className="mt-0.5 text-2xl font-bold">{firstName} 👋</h1>
            {mainCase ? (
              <p className="mt-1 text-sm text-blue-200">
                Tu caso{" "}
                <span className="font-mono font-semibold text-white">{mainCase.case_number}</span>
                {" "}está siendo procesado.
              </p>
            ) : (
              <p className="mt-1 text-sm text-blue-200">No tienes casos activos aún.</p>
            )}
          </div>
          {mainCase && (
            <div className="shrink-0">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${STATUS_COLOR[mainCase.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}
              >
                {STATUS_LABEL[mainCase.status] || mainCase.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Case progress timeline */}
      {mainCase && !["denegado", "cerrado", "archivado"].includes(mainCase.status) && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Progreso de tu caso
          </h2>
          <div className="flex items-center justify-between gap-1">
            {STAGES.map((stage, i) => {
              const completed = i < currentStage;
              const active = i === currentStage;
              const pending = i > currentStage;
              return (
                <div key={stage.key} className="flex flex-1 flex-col items-center gap-2">
                  {/* Connector line before */}
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div
                        className={`h-0.5 flex-1 ${i <= currentStage ? "bg-brand-red" : "bg-gray-200"}`}
                      />
                    )}
                    {/* Circle */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        completed
                          ? "border-brand-red bg-brand-red text-white"
                          : active
                          ? "border-brand-blue bg-brand-blue text-white"
                          : "border-gray-200 bg-white text-gray-300"
                      }`}
                    >
                      {completed ? (
                        <CheckCircle size={16} />
                      ) : active ? (
                        <Clock size={15} />
                      ) : (
                        <Circle size={14} />
                      )}
                    </div>
                    {i < STAGES.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 ${i < currentStage ? "bg-brand-red" : "bg-gray-200"}`}
                      />
                    )}
                  </div>
                  {/* Label */}
                  <span
                    className={`text-center text-xs font-medium leading-tight ${
                      completed
                        ? "text-brand-red"
                        : active
                        ? "text-brand-blue"
                        : "text-gray-400"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
          {mainCase.updated_at && (
            <p className="mt-4 text-center text-xs text-gray-400">
              Última actualización: {formatDate(mainCase.updated_at)}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Documents */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={18} className="text-brand-blue" />
            <h2 className="font-semibold text-gray-800">Documentos</h2>
          </div>
          {docs.length > 0 ? (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{doc.name}</p>
                    {doc.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{doc.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DOC_STATUS_COLOR[doc.status] || "text-gray-600 bg-gray-100"}`}
                  >
                    {DOC_STATUS_LABEL[doc.status] || doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <FileText size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No hay documentos todavía.</p>
              <p className="mt-1 text-xs text-gray-400">
                Tu equipo te notificará cuando necesites enviar documentos.
              </p>
            </div>
          )}
        </div>

        {/* Messages from your team */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-blue" />
            <h2 className="font-semibold text-gray-800">Mensajes de tu equipo</h2>
          </div>
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-blue-100 bg-blue-50 p-3"
                >
                  <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                  <p className="mt-1.5 text-xs text-gray-400">{formatDate(note.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Sin mensajes por ahora.</p>
              <p className="mt-1 text-xs text-gray-400">
                Aquí aparecerán las actualizaciones de tu caso.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Case detail */}
      {mainCase && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <h2 className="mb-4 font-semibold text-gray-800">Detalle del caso</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Número de caso</p>
              <p className="mt-1 font-mono text-lg font-bold text-brand-blue">{mainCase.case_number}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Estado</p>
              <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium ${STATUS_COLOR[mainCase.status] || ""}`}>
                {STATUS_LABEL[mainCase.status] || mainCase.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Tipo de caso</p>
              <p className="mt-1 text-sm text-gray-700">
                {mainCase.case_type === "talento_extraordinario"
                  ? "Talento Extraordinario (O-1B / EB-1B)"
                  : mainCase.case_type?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Fecha de apertura</p>
              <p className="mt-1 text-sm text-gray-700">{formatDate(mainCase.created_at)}</p>
            </div>
            {mainCase.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Descripción</p>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">{mainCase.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact card */}
      <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-brand-blue">¿Tienes preguntas sobre tu caso?</h2>
            <p className="mt-1 text-sm text-gray-600">
              Nuestro equipo está disponible para ayudarte. Contáctanos cuando lo necesites.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end shrink-0">
            <a
              href="mailto:actionusaaillc@gmail.com"
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark transition-colors"
            >
              <Mail size={15} /> actionusaaillc@gmail.com
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
