"use client";

import { useState } from "react";
import { Scale, Pencil, Check, AlertCircle } from "lucide-react";

// Identidad Jurídica del Caso — capa fundacional del dominio, precondición
// de la Legal Decision Cycle Policy. Responsabilidad exclusiva: mostrar y
// permitir confirmar/modificar Initial Legal Petition (histórica,
// inmutable tras su primera confirmación) y Active Legal Petition
// (mutable). Invariante (Restricciones de Implementación Fase 5, punto 4):
// esta sección NUNCA dispara automáticamente un Legal Decision Cycle —
// guardar aquí es exclusivamente la Acción 1 (cambiar la petición activa),
// nunca la Acción 2 (ejecutar el ciclo), que pertenece a la futura sección
// Legal Decision.

interface LegalIdentitySectionProps {
  caseId: string;
  initialLegalPetition: string | null;
  activeLegalPetition: string | null;
  userRole: string;
}

const VISA_TYPES = ["O-1A", "O-1B", "EB-1A"] as const;

export function LegalIdentitySection({
  caseId,
  initialLegalPetition,
  activeLegalPetition,
  userRole,
}: LegalIdentitySectionProps) {
  const [initial, setInitial] = useState(initialLegalPetition);
  const [active, setActive] = useState(activeLegalPetition);
  const [editingActive, setEditingActive] = useState(false);
  const [draftActive, setDraftActive] = useState(active ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTrigger = ["admin", "supervisor", "agent"].includes(userRole);
  const isConfirmed = initial !== null && active !== null;

  // Confirmación inicial: solo posible cuando Initial Legal Petition
  // todavía no existe. Escribe initial y active con el mismo valor,
  // consistente con la Decisión de Dominio ("nacen idénticas en el mismo
  // instante"). Después de este punto, initial nunca vuelve a escribirse
  // desde este componente — es inmutable por diseño de dominio (la
  // garantía técnica de esa inmutabilidad pertenece a la implementación
  // de backend, no a esta UI).
  async function confirmInitialPetition(value: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases/legal-identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, initial_legal_petition: value, active_legal_petition: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al confirmar la Petición Jurídica Inicial.");
      } else {
        setInitial(value);
        setActive(value);
      }
    } catch {
      setError("Error de red al confirmar la Petición Jurídica.");
    } finally {
      setLoading(false);
    }
  }

  // Cambio de Active Legal Petition — Acción 1, exclusivamente. Nunca
  // dispara el Legal Decision Cycle. Solo actualiza Case.
  async function updateActivePetition(value: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases/legal-identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, active_legal_petition: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al actualizar la Petición Jurídica Activa.");
      } else {
        setActive(value);
      }
    } catch {
      setError("Error de red al actualizar la Petición Jurídica Activa.");
    } finally {
      setLoading(false);
      setEditingActive(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="text-[#1B2B5E]" size={20} />
        <h2 className="text-lg font-semibold text-[#1B2B5E]">Identidad Jurídica del Caso</h2>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isConfirmed ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Este caso todavía no tiene una Petición Jurídica Inicial confirmada. Ningún Legal
            Decision Cycle puede ejecutarse hasta que el abogado la confirme.
          </p>
          {canTrigger && (
            <div className="flex flex-wrap gap-2">
              {VISA_TYPES.map((v) => (
                <button
                  key={v}
                  disabled={loading}
                  onClick={() => confirmInitialPetition(v)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#1B2B5E] hover:text-[#1B2B5E]"
                >
                  Confirmar {v}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Petición Jurídica Inicial
            </span>
            <p className="mt-1 text-sm text-gray-800">{initial}</p>
            <p className="mt-0.5 text-xs text-gray-400">Histórica — nunca cambia.</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Petición Jurídica Activa
              </span>
              {canTrigger && !editingActive && (
                <button onClick={() => { setEditingActive(true); setDraftActive(active ?? ""); }} className="text-gray-400 hover:text-[#1B2B5E]">
                  <Pencil size={14} />
                </button>
              )}
            </div>
            {editingActive ? (
              <div className="mt-1 space-y-2">
                <select
                  value={draftActive}
                  onChange={(e) => setDraftActive(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2 text-sm"
                >
                  {VISA_TYPES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    disabled={loading}
                    onClick={() => updateActivePetition(draftActive)}
                    className="flex items-center gap-1 rounded-lg bg-[#1B2B5E] px-3 py-1 text-xs text-white"
                  >
                    <Check size={12} /> Guardar
                  </button>
                  <button onClick={() => setEditingActive(false)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-800">{active}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
