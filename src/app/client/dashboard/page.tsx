import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList, Search, Hammer, Send, Award,
  CheckCircle2, Clock, Circle, Mail, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NotificationCard } from "./notification-card";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY  = "#1B2B5E";
const GOLD  = "#C9A84C";

const PHASES = [
  { label: "Intake",       sub: "Intake completado",           Icon: ClipboardList },
  { label: "Análisis",     sub: "En revisión por el equipo",   Icon: Search        },
  { label: "Construcción", sub: "Preparando petición",         Icon: Hammer        },
  { label: "Radicación",   sub: "Enviado a USCIS",             Icon: Send          },
  { label: "Aprobación",   sub: "Decisión USCIS",              Icon: Award         },
];

// Map case status → index of the ACTIVE phase (phases before it are complete)
function activePhaseIndex(status: string | null): number {
  switch (status) {
    case "nuevo":
    case "pendiente_documentos": return 1;
    case "en_progreso":
    case "en_revision":          return 2;
    case "aprobado":             return 5; // all complete
    default:                     return 1;
  }
}

const CASE_TYPE_LABEL: Record<string, string> = {
  talento_extraordinario: "O-1A / EB-1A — Talento Extraordinario",
};

const MODULE_NAMES: Record<number, string> = {
  1:  "Identidad del Aplicante",
  2:  "Documentos y Grupo Familiar",
  3:  "Historial Migratorio",
  4:  "Educación Formal",
  5:  "Cursos y Certificaciones",
  6:  "Experiencia Profesional",
  7:  "Empresas Propias",
  8:  "Referencias Profesionales",
  9:  "Evidencia Existente",
  10: "Información Estratégica",
  11: "Servicios Estratégicos",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // ── Fetch client + case ────────────────────────────────────────────────────
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("profile_id", user.id)
    .single();

  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_number, case_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  const mainCase = cases?.[0] ?? null;

  // ── Fetch notifications ────────────────────────────────────────────────────
  const { data: notifications } = await supabase
    .from("agent_notifications")
    .select("id, subject, body_text, sent_at, read_at")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(5);

  // ── Fetch intake_submission for tasks ─────────────────────────────────────
  let moduleProgress: Record<string, string> = {};
  if (mainCase) {
    const { data: intake } = await supabase
      .from("intake_submissions")
      .select("module_progress")
      .eq("case_id", mainCase.id)
      .single();
    moduleProgress = (intake?.module_progress as Record<string, string>) ?? {};
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const fullName   = client
    ? `${client.first_name} ${client.last_name}`.trim()
    : profile?.full_name || "Cliente";
  const firstName  = fullName.split(" ")[0];
  const caseLabel  = mainCase
    ? (CASE_TYPE_LABEL[mainCase.case_type] ?? mainCase.case_type)
    : null;

  const activePhase = activePhaseIndex(mainCase?.status ?? null);

  // Incomplete steps (1-11, skip 12 = submit)
  const incompleteTasks = Object.entries(MODULE_NAMES)
    .map(([k, name]) => ({ step: Number(k), name, status: moduleProgress[k] ?? "empty" }))
    .filter(t => t.status !== "complete");

  const totalModules  = Object.keys(MODULE_NAMES).length; // 11
  const doneModules   = totalModules - incompleteTasks.length;
  const completionPct = Math.round((doneModules / totalModules) * 100);

  const unreadCount = (notifications ?? []).filter(n => n.read_at === null).length;

  return (
    <div className="space-y-6">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #2a3f7e 100%)` }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm" style={{ color: GOLD }}>Bienvenido/a de vuelta</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{fullName}</h1>
            {caseLabel && (
              <p className="mt-1.5 text-sm text-blue-200">{caseLabel}</p>
            )}
            {mainCase?.case_number && (
              <p className="mt-0.5 font-mono text-xs text-blue-300">
                Caso #{mainCase.case_number}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {unreadCount > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: GOLD }}
              >
                {unreadCount} notificación{unreadCount > 1 ? "es" : ""} nueva{unreadCount > 1 ? "s" : ""}
              </span>
            )}
            {mainCase?.status && (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Estado: {mainCase.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 1. CASE TIMELINE ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-400">
          Progreso de tu caso
        </h2>

        {/* Mobile: vertical list */}
        <ol className="flex flex-col gap-4 sm:hidden">
          {PHASES.map(({ label, sub, Icon }, i) => {
            const done   = i < activePhase;
            const active = i === activePhase;
            return (
              <li key={label} className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                  style={{
                    borderColor: done || active ? NAVY : "#e5e7eb",
                    background:  done ? NAVY : active ? GOLD : "#f9fafb",
                    boxShadow:   active ? `0 0 0 4px ${GOLD}33` : undefined,
                  }}
                >
                  {done
                    ? <CheckCircle2 size={16} color="#fff" />
                    : active
                    ? <Icon size={15} color={NAVY} />
                    : <Icon size={15} color="#d1d5db" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-semibold ${done || active ? "text-gray-800" : "text-gray-400"}`}>
                    {label}
                  </p>
                  <p className={`text-xs ${active ? "font-medium" : "text-gray-400"}`}
                     style={{ color: active ? GOLD : undefined }}>
                    {active ? sub : done ? "Completado" : "Pendiente"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Desktop: horizontal */}
        <ol className="hidden sm:flex items-start">
          {PHASES.map(({ label, sub, Icon }, i) => {
            const done   = i < activePhase;
            const active = i === activePhase;
            const last   = i === PHASES.length - 1;
            return (
              <li key={label} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{ background: i <= activePhase ? NAVY : "#e5e7eb" }}
                    />
                  )}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                    style={{
                      borderColor: done || active ? NAVY : "#e5e7eb",
                      background:  done ? NAVY : active ? GOLD : "#f9fafb",
                      boxShadow:   active ? `0 0 0 5px ${GOLD}33` : undefined,
                    }}
                  >
                    {done
                      ? <CheckCircle2 size={17} color="#fff" />
                      : active
                      ? <Icon size={16} color={NAVY} />
                      : <Icon size={16} color="#d1d5db" />
                    }
                  </div>
                  {!last && (
                    <div
                      className="h-0.5 flex-1"
                      style={{ background: i < activePhase ? NAVY : "#e5e7eb" }}
                    />
                  )}
                </div>
                <div className="mt-3 text-center px-1">
                  <p className={`text-xs font-bold ${done || active ? "text-gray-800" : "text-gray-400"}`}>
                    {label}
                  </p>
                  <p
                    className="mt-0.5 text-xs leading-tight"
                    style={{ color: active ? GOLD : done ? "#9ca3af" : "#d1d5db" }}
                  >
                    {active ? sub : done ? "Completado" : "Pendiente"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {!mainCase && (
          <p className="mt-4 text-center text-xs text-gray-400">
            Tu caso será creado una vez que completes el formulario de intake.
          </p>
        )}
      </section>

      {/* ─── 2 + 3: Notifications & Tasks side-by-side on lg ────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ─── 2. NOTIFICATIONS CENTER ─────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Notificaciones
            </h2>
            {unreadCount > 0 && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ background: GOLD }}
              >
                {unreadCount} nueva{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {notifications && notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map(n => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: `${NAVY}10` }}
              >
                <Mail size={20} style={{ color: NAVY }} />
              </div>
              <p className="text-sm font-medium text-gray-600">Sin notificaciones</p>
              <p className="mt-1 text-xs text-gray-400">
                Aquí recibirás actualizaciones de tu caso.
              </p>
            </div>
          )}
        </section>

        {/* ─── 3. PENDING TASKS ────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Tareas pendientes
            </h2>
            <span className="text-xs font-semibold text-gray-500">
              {doneModules}/{totalModules} completados
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-gray-500">Progreso del intake</span>
              <span
                className="text-xs font-bold"
                style={{ color: completionPct === 100 ? "#16a34a" : NAVY }}
              >
                {completionPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct === 100
                    ? "#16a34a"
                    : `linear-gradient(90deg, ${NAVY}, ${GOLD})`,
                }}
              />
            </div>
          </div>

          {incompleteTasks.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {incompleteTasks.map(({ step, name, status }) => (
                <Link
                  key={step}
                  href={`/intake?step=${step}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-all hover:shadow-sm"
                  style={{
                    borderColor: status === "partial" ? `${GOLD}60` : "#e5e7eb",
                    background:  status === "partial" ? `${GOLD}08` : "#f9fafb",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: status === "partial" ? GOLD : "#e5e7eb",
                        color:      status === "partial" ? "#fff" : "#9ca3af",
                      }}
                    >
                      {step}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{name}</p>
                      <p
                        className="text-xs"
                        style={{ color: status === "partial" ? GOLD : "#9ca3af" }}
                      >
                        {status === "partial" ? "Incompleto" : "Sin comenzar"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-gray-400" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <p className="text-sm font-semibold text-green-700">¡Todo completado!</p>
              <p className="mt-1 text-xs text-gray-400">
                Has completado todos los módulos del intake.
              </p>
            </div>
          )}

          {incompleteTasks.length > 0 && (
            <Link
              href="/intake"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: NAVY }}
            >
              Continuar intake
              <ChevronRight size={15} />
            </Link>
          )}
        </section>
      </div>

      {/* ─── Contact footer ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: `${GOLD}40`, background: `${GOLD}08` }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold" style={{ color: NAVY }}>
              ¿Tienes preguntas sobre tu caso?
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              Nuestro equipo responde en menos de 24 horas.
            </p>
          </div>
          <a
            href="mailto:actionusaaillc@gmail.com"
            className="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90"
            style={{ background: NAVY }}
          >
            <Mail size={15} />
            Escribir al equipo
          </a>
        </div>
      </div>

    </div>
  );
}
