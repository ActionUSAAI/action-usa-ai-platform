"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, AlertCircle, Info, Paperclip, X } from "lucide-react";
import type { EvidenceStatus } from "./types";

export function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12}/>{error}</p>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
    />
  );
}

export function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
    >
      {children}
    </select>
  );
}

export function YesNo({ value, onChange, yesLabel = "Sí", noLabel = "No" }: {
  value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string;
}) {
  return (
    <div className="flex gap-3">
      {[true, false].map(v => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
            value === v
              ? v ? "border-brand-blue bg-brand-blue text-white" : "border-red-500 bg-red-500 text-white"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}>
          {v ? `✓ ${yesLabel}` : `✗ ${noLabel}`}
        </button>
      ))}
    </div>
  );
}

export function TriState({ value, onChange, labels }: {
  value: string; onChange: (v: string) => void;
  labels: [string, string, string];
}) {
  const opts = ["si", "no", "en_tramite"];
  return (
    <div className="flex gap-2">
      {opts.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`flex-1 rounded-lg border-2 py-2 text-xs font-medium transition-all ${
            value === opt ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}>
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

export function EvidenceSelector({ value, onChange }: {
  value: EvidenceStatus; onChange: (v: EvidenceStatus) => void;
}) {
  const opts: { v: EvidenceStatus; label: string; cls: string }[] = [
    { v: "tengo",    label: "✓ Tengo",       cls: "border-green-500 bg-green-500 text-white" },
    { v: "tal_vez",  label: "? Tal vez tengo", cls: "border-amber-500 bg-amber-500 text-white" },
    { v: "no_tengo", label: "✗ No tengo",     cls: "border-red-500 bg-red-500 text-white" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
            value === o.v ? o.cls : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DocSelector({ value, onChange }: {
  value: boolean | null; onChange: (v: boolean | null) => void;
}) {
  const opts: Array<{ v: boolean | null; label: string }> = [
    { v: true,  label: "✓ Sí tengo" },
    { v: false, label: "✗ No tengo" },
    { v: null,  label: "— No aplica" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o, i) => (
        <button key={i} type="button" onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg border-2 py-2 text-xs font-medium transition-all ${
            value === o.v ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 rounded-lg border-2 border-dashed border-brand-blue/40 px-4 py-2.5 text-sm font-medium text-brand-blue hover:border-brand-blue hover:bg-brand-blue/5 transition-colors">
      <Plus size={16}/>{label}
    </button>
  );
}

export function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
      title="Eliminar">
      <Trash2 size={15}/>
    </button>
  );
}

export function InfoBox({ children, variant = "blue" }: {
  children: React.ReactNode; variant?: "blue" | "amber" | "green";
}) {
  const cls = {
    blue:  "border-blue-100 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-green-100 bg-green-50 text-green-800",
  }[variant];
  return (
    <div className={`flex gap-2.5 rounded-xl border p-4 text-sm ${cls}`}>
      <Info size={16} className="mt-0.5 shrink-0"/>
      <div>{children}</div>
    </div>
  );
}

export function Card({ label, index, onRemove, children }: {
  label: string; index: number; onRemove?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pt-10">
      <div className="absolute left-4 top-3 text-xs font-bold uppercase tracking-wider text-brand-blue">
        {label} {index + 1}
      </div>
      {onRemove && <RemoveBtn onClick={onRemove}/>}
      {children}
    </div>
  );
}

export function DispositionBox({ value, onChange, label }: {
  value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-medium text-amber-800">
        Sin {label} actualmente — describe tu estrategia o plan:
      </p>
      <Textarea value={value} onChange={onChange}
        placeholder={`Estoy en proceso de obtener ${label.toLowerCase()}...`} rows={3}/>
    </div>
  );
}

export function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-gray-200"/>
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</span>
      <div className="h-px flex-1 bg-gray-200"/>
    </div>
  );
}

export function FileUpload({ sessionId, storagePath, filePath, fileName, onChange }: {
  sessionId: string;
  storagePath: string;
  filePath: string;
  fileName: string;
  onChange: (v: { filePath: string; fileName: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no puede exceder 10MB.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", storagePath);
      fd.append("sessionId", sessionId || "tmp");

      const res = await fetch("/api/intake/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir");
      onChange({ filePath: json.filePath, fileName: json.fileName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    onChange({ filePath: "", fileName: "" });
    if (inputRef.current) inputRef.current.value = "";
    setError("");
  }

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
        <Paperclip size={11}/> Subir documento — opcional (PDF, JPG, PNG, máx 10MB)
      </p>
      {fileName ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <span className="flex-1 truncate text-sm text-green-800">{fileName}</span>
          <button type="button" onClick={handleRemove}
            className="flex items-center gap-1 rounded text-xs text-green-600 hover:text-red-500 transition-colors">
            <X size={13}/> Quitar
          </button>
        </div>
      ) : (
        <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 transition-colors ${
          uploading ? "border-gray-200 bg-gray-50" : "border-brand-blue/40 hover:border-brand-blue hover:bg-brand-blue/5"
        }`}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFile}
            disabled={uploading}
            className="sr-only"
          />
          <span className={`text-sm ${uploading ? "text-gray-400" : "text-brand-blue"}`}>
            {uploading ? "Subiendo..." : "Seleccionar archivo..."}
          </span>
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
