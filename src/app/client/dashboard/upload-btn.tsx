"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export function UploadBtn({ caseId, clientId }: { caseId: string; clientId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setUploading(true);
    setStatus("idle");
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${caseId}/${Date.now()}_${safeFileName}`;

    // Upload to storage bucket "case-documents"
    const { data: upload, error: uploadErr } = await supabase.storage
      .from("case-documents")
      .upload(filePath, file, { upsert: false });

    if (uploadErr) {
      setStatus("error");
      setMessage("No se pudo subir el archivo. Verifica que el bucket 'case-documents' exista en Supabase Storage.");
      setUploading(false);
      return;
    }

    // Create document record
    const { error: docErr } = await supabase.from("documents").insert({
      case_id: caseId,
      client_id: clientId,
      uploaded_by: user.id,
      name: file.name,
      file_path: upload.path,
      file_size: file.size,
      mime_type: file.type,
      status: "pendiente",
    });

    if (docErr) {
      setStatus("error");
      setMessage("Archivo subido pero hubo un error al registrarlo. Contacta al equipo.");
      setUploading(false);
      return;
    }

    setStatus("ok");
    setMessage("¡Documento subido correctamente!");
    setUploading(false);
    // Refresh server component to show new document
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        onChange={handleFile}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60 transition-colors shadow-sm"
      >
        {uploading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Upload size={15} />
        )}
        {uploading ? "Subiendo..." : "Subir documento"}
      </button>

      {status === "ok" && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle size={13} /> {message}
        </p>
      )}
      {status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle size={13} /> {message}
        </p>
      )}
    </div>
  );
}
