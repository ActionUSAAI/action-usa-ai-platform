import { CheckCircle, AlertCircle, XCircle, MinusCircle, Loader2 } from "lucide-react";
import type { ModuleStatus } from "../types";

type Props = {
  statuses: ModuleStatus[];
  show12: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
};

const MODULE_NAMES = [
  "Identidad del Aplicante",
  "Documentos y Grupo Familiar",
  "Historial Migratorio",
  "Educación Formal",
  "Cursos y Certificaciones",
  "Experiencia Profesional",
  "Empresas Propias",
  "Referencias Profesionales",
  "Evidencia Existente",
  "Información Estratégica",
  "Servicios Opcionales",
  "Información del Peticionario",
  "Opinión Consultiva y Acompañantes",
];

const STATUS_CONFIG = {
  complete:   { Icon: CheckCircle,  color: "text-green-600",  bg: "bg-green-50 border-green-200",  label: "Completo"  },
  partial:    { Icon: AlertCircle,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",  label: "Parcial"   },
  empty:      { Icon: XCircle,      color: "text-gray-400",   bg: "bg-gray-50 border-gray-200",    label: "Vacío"     },
  not_applicable: { Icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-50 border-gray-100",   label: "No aplica" },
};

// Index of the "Servicios Opcionales" row in MODULE_NAMES (0-based)
const OPTIONAL_SERVICES_IDX = 10;

export function Module13({ statuses, show12, loading, error, onSubmit }: Props) {
  // Module 12 (Servicios Opcionales) was skipped — treat as not applicable, not empty
  const effectiveStatuses = statuses.map((s, i) =>
    i === OPTIONAL_SERVICES_IDX && !show12 ? "not_applicable" : s
  ) as (ModuleStatus | "not_applicable")[];

  const complete = effectiveStatuses.filter(s => s === "complete").length;
  const partial  = effectiveStatuses.filter(s => s === "partial").length;
  const empty    = effectiveStatuses.filter(s => s === "empty").length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-green-50 border border-green-200 p-3">
          <p className="text-2xl font-bold text-green-600">{complete}</p>
          <p className="text-xs text-green-700">Completos</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-2xl font-bold text-amber-600">{partial}</p>
          <p className="text-xs text-amber-700">Parciales</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
          <p className="text-2xl font-bold text-gray-400">{empty}</p>
          <p className="text-xs text-gray-500">Vacíos</p>
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {MODULE_NAMES.map((name, i) => {
          const status = effectiveStatuses[i] ?? "empty";
          const { Icon, color, bg, label } = STATUS_CONFIG[status];
          return (
            <div key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${bg}`}>
              <Icon size={17} className={`shrink-0 ${color}`}/>
              <span className="flex-1 text-sm font-medium text-gray-700">
                Módulo {i + 1} — {name}
              </span>
              <span className={`text-xs font-semibold ${color}`}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Message */}
      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 text-sm text-brand-blue space-y-1">
        <p className="font-semibold">Puedes enviar tu información ahora</p>
        <p>
          Puedes completar los módulos pendientes después desde tu portal de cliente.
          Nuestro equipo comenzará a revisar tu caso con la información disponible.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0"/>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="w-full rounded-xl bg-brand-red py-4 text-base font-bold text-white hover:bg-brand-red-dark disabled:opacity-60 transition-colors shadow-md"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin"/>
            Enviando tu información...
          </span>
        ) : (
          "Enviar mi información a ACTION USA →"
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        Al enviar, aceptas que ACTION USA procese tu información para evaluar tu elegibilidad.
        Tus datos son confidenciales.
      </p>
    </div>
  );
}
