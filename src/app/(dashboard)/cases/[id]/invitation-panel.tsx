"use client";

import { useState } from "react";
import { Send, Mail, CheckCircle, Clock, XCircle, Eye, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  status: "pending" | "opened" | "submitted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
}

interface Props {
  caseId: string;
  clientId: string;
  clientEmail: string;
  invitations: Invitation[];
}

const STATUS_CONFIG: Record<
  Invitation["status"],
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  pending:   { label: "Enviada",    color: "text-blue-700",  bg: "bg-blue-50 border-blue-200",   Icon: Clock       },
  opened:    { label: "Abierta",    color: "text-amber-700", bg: "bg-amber-50 border-amber-200", Icon: Eye         },
  submitted: { label: "Completada", color: "text-green-700", bg: "bg-green-50 border-green-200", Icon: CheckCircle },
  expired:   { label: "Vencida",    color: "text-gray-500",  bg: "bg-gray-50 border-gray-200",   Icon: XCircle     },
  revoked:   { label: "Revocada",   color: "text-red-600",   bg: "bg-red-50 border-red-200",     Icon: XCircle     },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short", year: "numeric" });
}

export function InvitationPanel({ caseId, clientId, clientEmail, invitations: initial }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>(initial);
  const [emailOverride, setEmailOverride] = useState(clientEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ invitation_id: string; expires_at: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  const activeInvitation = invitations.find(i => i.status === "pending" || i.status === "opened");
  const visibleInvitations = showAll ? invitations : invitations.slice(0, 3);

  async function send() {
    setLoading(true);
    setError(null);
    setLastResult(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, client_id: clientId, email: emailOverride }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al enviar la invitación.");
        return;
      }

      setLastResult({ invitation_id: data.invitation_id, expires_at: data.expires_at });
      if (data.email_warning) {
        setError(`Invitación creada, pero el email falló: ${data.email_warning}`);
      }

      // Prepend new invitation to local list (optimistic)
      setInvitations(prev => [{
        id: data.invitation_id,
        email: emailOverride,
        status: "pending",
        expires_at: data.expires_at,
        created_at: new Date().toISOString(),
        opened_at: null,
        submitted_at: null,
      }, ...prev]);
      setShowEmailInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Mail size={15} className="text-[#1B2B5E]" />
        Invitación AUCIS
      </h3>

      {/* Active invitation callout */}
      {activeInvitation && !lastResult && (
        <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-0.5 ${STATUS_CONFIG[activeInvitation.status].bg}`}>
          <p className={`font-semibold ${STATUS_CONFIG[activeInvitation.status].color}`}>
            {STATUS_CONFIG[activeInvitation.status].label} · {activeInvitation.email}
          </p>
          <p className="text-gray-500">
            Vence: {formatDate(activeInvitation.expires_at)}
          </p>
        </div>
      )}

      {/* Success banner */}
      {lastResult && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs space-y-0.5">
          <p className="font-semibold text-green-700 flex items-center gap-1.5">
            <CheckCircle size={13} /> Invitación enviada a {emailOverride}
          </p>
          <p className="text-gray-500">Vence: {formatDate(lastResult.expires_at)}</p>
        </div>
      )}

      {/* Error / warning */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Email override input */}
      {showEmailInput && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">Email de destino</label>
          <input
            type="email"
            value={emailOverride}
            onChange={e => setEmailOverride(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#1B2B5E] focus:outline-none focus:ring-1 focus:ring-[#1B2B5E]"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={loading || !emailOverride}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2B5E] px-3 py-2 text-xs font-semibold text-[#C9A84C] hover:bg-[#121e42] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Enviando...
            </span>
          ) : (
            <>
              {activeInvitation ? <RotateCcw size={12} /> : <Send size={12} />}
              {activeInvitation ? "Reenviar invitación" : "Enviar invitación"}
            </>
          )}
        </button>
        <button
          onClick={() => setShowEmailInput(v => !v)}
          title="Cambiar email"
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <Mail size={13} />
        </button>
      </div>

      {/* History */}
      {invitations.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium pt-1">Historial</p>
          {visibleInvitations.map(inv => {
            const { Icon, color, label } = STATUS_CONFIG[inv.status];
            return (
              <div key={inv.id} className="flex items-center gap-2 text-xs text-gray-600">
                <Icon size={12} className={`shrink-0 ${color}`} />
                <span className={`font-medium ${color}`}>{label}</span>
                <span className="text-gray-400 truncate flex-1">{inv.email}</span>
                <span className="text-gray-400 shrink-0">{formatDate(inv.created_at)}</span>
              </div>
            );
          })}
          {invitations.length > 3 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-1 text-xs text-[#1B2B5E] hover:underline pt-0.5"
            >
              {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showAll ? "Ver menos" : `Ver ${invitations.length - 3} más`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
