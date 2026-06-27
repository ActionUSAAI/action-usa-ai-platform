import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckCircle, Clock, Circle, FileText, MessageSquare, Mail } from "lucide-react";
import { UploadBtn } from "./upload-btn";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  cerrado: "bg-gray-100 text-gray-600 border-gray-200",
  archivado: "bg-gray-100 text-gray-500 border-gray-200",
};

const DOC_STATUS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente de revisión", color: "text-amber-600 bg-amber-50 border-amber-200" },
  recibido: { label: "Recibido", color: "text-blue-600 bg-blue-50 border-blue-200" },
  verificado: { label: "Verificado ✓", color: "text-green-600 bg-green-50 border-green-200" },
  rechazado: { label: "Rechazado", color: "text-red-600 bg-red-50 border-red-200" },
};

const STAGES = [
  { key: "nuevo", label: "Recibido" },
  { key: "en_progreso", label: "En proceso" },
  { key: "pendiente_documentos", label: "Documentos" },
  { key: "en_revision", label: "En revisión" },
  { key: "aprobado", label: "Aprobado" },
];

function stageIndex(status: string) {
  const idx = ["nuevo", "en_progreso", "pendiente_documentos", "en_revision", "aprobado"].indexOf(status);
  return idx >= 0 ? idx : 0;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ClientDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // Client record (linked by profile_id after callback)
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("profile_id", user.id)
    .single();

  // Cases (RLS grants access via clients.profile_id = auth.uid())
  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_number, case_type, status, title, description, created_at, updated_at")
    .order("created_at", { ascending: false });

  const mainCase = cases?.[0] ?? null;
  const currentStage = mainCase ? stageIndex(mainCase.status) : 0;

  // Notes visible to client
  let notes: { id: string; content: string; created_at: string }[] = [];
  if (mainCase) {
    const { data } = await supabase
      .from("case_notes")
      .select("id, content, created_at")
      .eq("case_id", mainCase.id)
      .eq("is_visible_to_client", true)
      .order("created_at", { ascending: false })
      .limit(10);
    notes = data || [];
  }

  // Documents
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
  const showTerminal = mainCase && ["denegado", "cerrado", "archivado"].includes(mainCase.status);

  return (
    <div className="space-y-6">

      {/* ─── Hero ─── */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue-dark p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-blue-200 text-sm">Bienvenido(a),</p>
            <h1 className="mt-0.5 text-2xl font-bold">{firstName} 👋</h1>
            {mainCase ? (
              <p className="mt-1 text-sm text-blue-200">
                Caso{" "}
                <span className="font-mono font-bold text-white">{mainCase.case_number}</span>
                {" · "}Evaluación O-1B / EB-1B
              </p>
            ) : (
              <p className="mt-1 text-sm text-blue-200">Tu evaluación está siendo procesada.</p>
            )}
          </div>
          {mainCase && (
            <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${STATUS_COLOR[mainCase.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
              {STATUS_LABEL[mainCase.status] || mainCase.status}
            </span>
          )}
        </div>
      </div>

      {/* ─── Progress timeline ─── */}
      {mainCase && !showTerminal && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Progreso de tu caso
          </p>
          <div className="flex items-center">
            {STAGES.map((stage, i) => {
              const done = i < currentStage;
              const active = i === currentStage;
              return (
                <div key={stage.key} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div className={`h-0.5 flex-1 ${i <= currentStage ? "bg-brand-red" : "bg-gray-200"}`} />
                    )}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-brand-red bg-brand-red text-white" : active ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-300"}`}>
                      {done ? <CheckCircle size={15} /> : active ? <Clock size={14} /> : <Circle size={13} />}
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`h-0.5 flex-1 ${i < currentStage ? "bg-brand-red" : "bg-gray-200"}`} />
                    )}
                  </div>
                  <span className={`mt-2 text-center text-xs font-medium leading-tight ${done ? "text-brand-red" : active ? "text-brand-blue" : "text-gray-400"}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
          {mainCase.updated_at && (
            <p className="mt-4 text-center text-xs text-gray-400">
              Última actualización: {fmtDate(mainCase.updated_at)}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ─── Documents ─── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-brand-blue" />
              <h2 className="font-semibold text-gray-800">Documentos</h2>
              {docs.length > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {docs.length}
                </span>
              )}
            </div>
          </div>

          {docs.length > 0 ? (
            <div className="mb-4 space-y-2.5">
              {docs.map((doc) => {
                const ds = DOC_STATUS[doc.status] || { label: doc.status, color: "text-gray-600 bg-gray-50 border-gray-200" };
                return (
                  <div key={doc.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{doc.name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{fmtDate(doc.created_at)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${ds.color}`}>
                      {ds.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-dashed border-gray-200 py-6 text-center">
              <FileText size={24} className="mx-auto mb-1.5 text-gray-300" />
              <p className="text-sm text-gray-500">Sin documentos todavía.</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Sube tus documentos aquí cuando estés listo.
              </p>
            </div>
          )}

          {mainCase && client && (
            <UploadBtn caseId={mainCase.id} clientId={client.id} />
          )}
        </div>

        {/* ─── Messages ─── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-blue" />
            <h2 className="font-semibold text-gray-800">Mensajes de tu equipo</h2>
            {notes.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                {notes.length}
              </span>
            )}
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  <p className="mt-1.5 text-xs text-gray-400">{fmtDate(note.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-1.5 text-gray-300" />
              <p className="text-sm text-gray-500">Sin mensajes todavía.</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Aquí verás las actualizaciones de tu caso.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Case detail ─── */}
      {mainCase && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <h2 className="mb-4 font-semibold text-gray-800">Detalle del caso</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Número de caso</p>
              <p className="mt-1 font-mono text-lg font-bold text-brand-blue">{mainCase.case_number}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Estado</p>
              <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[mainCase.status] || ""}`}>
                {STATUS_LABEL[mainCase.status] || mainCase.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Tipo</p>
              <p className="mt-1 text-sm text-gray-700">
                {mainCase.case_type === "talento_extraordinario" ? "O-1B / EB-1B" : (mainCase.case_type || "—").replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Apertura</p>
              <p className="mt-1 text-sm text-gray-700">{fmtDate(mainCase.created_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Contact ─── */}
      <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-brand-blue">¿Tienes preguntas?</h2>
            <p className="mt-1 text-sm text-gray-600">
              Contáctanos directamente y responderemos lo antes posible.
            </p>
          </div>
          <a
            href="mailto:actionusaaillc@gmail.com"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm"
          >
            <Mail size={15} /> Escribir al equipo
          </a>
        </div>
      </div>

    </div>
  );
}
