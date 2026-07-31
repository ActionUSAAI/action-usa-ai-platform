"use client";

/**
 * Genera una URL firmada de Storage y abre el archivo en una nueva pestaña.
 * Utilidad compartida — antes duplicada en a2-panel.tsx y a3a4-panel.tsx;
 * extraída al agregar un tercer consumidor (documents-panel.tsx).
 */
export async function downloadFile(path: string, displayName?: string): Promise<void> {
  try {
    const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    window.open(data.url, "_blank");
  } catch (e) {
    alert(`Error al generar enlace${displayName ? ` para ${displayName}` : ""}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
