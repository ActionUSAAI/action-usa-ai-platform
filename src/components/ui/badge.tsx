import { cn } from "@/utils/cn";
import type { CaseStatus, Priority } from "@/types/database";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gray";
  className?: string;
}

const variantClasses = {
  default: "bg-brand-blue/10 text-brand-blue",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-700",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export const statusBadgeVariant: Record<CaseStatus, BadgeProps["variant"]> = {
  nuevo: "info",
  en_progreso: "default",
  pendiente_documentos: "warning",
  en_revision: "warning",
  aprobado: "success",
  denegado: "danger",
  cerrado: "gray",
  archivado: "gray",
};

export const statusLabels: Record<CaseStatus, string> = {
  nuevo: "Nuevo",
  en_progreso: "En Progreso",
  pendiente_documentos: "Pendiente Docs",
  en_revision: "En Revisión",
  aprobado: "Aprobado",
  denegado: "Denegado",
  cerrado: "Cerrado",
  archivado: "Archivado",
};

export const priorityBadgeVariant: Record<Priority, BadgeProps["variant"]> = {
  baja: "gray",
  normal: "info",
  alta: "warning",
  urgente: "danger",
};

export const priorityLabels: Record<Priority, string> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};
