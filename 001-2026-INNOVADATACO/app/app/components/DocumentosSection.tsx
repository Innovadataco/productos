"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

interface Documento {
  id: string;
  nombre: string;
  archivoOriginal: string;
  tipo: string;
  mimeType: string;
  tamanioBytes: number;
  createdAt: string;
  subidoPor: { nombre: string } | null;
}

const tiposDocumento = [
  { key: "PLIEGOS", label: "Pliegos" },
  { key: "PROPUESTA_TECNICA", label: "Propuesta técnica" },
  { key: "PROPUESTA_ECONOMICA", label: "Propuesta económica" },
  { key: "CONTRATO", label: "Contrato" },
  { key: "ACTA_INICIO", label: "Acta de inicio" },
  { key: "ACTA_SEGUIMIENTO", label: "Acta de seguimiento" },
  { key: "ENTREGABLE", label: "Entregable" },
  { key: "FACTURA", label: "Factura" },
  { key: "OTRO", label: "Otro" },
];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function iconoPorTipo(tipo: string) {
  switch (tipo) {
    case "PLIEGOS":
    case "PROPUESTA_TECNICA":
    case "PROPUESTA_ECONOMICA":
      return "fa-file-alt";
    case "CONTRATO":
    case "ACTA_INICIO":
    case "ACTA_SEGUIMIENTO":
      return "fa-file-signature";
    case "ENTREGABLE":
      return "fa-box";
    case "FACTURA":
      return "fa-file-invoice-dollar";
    default:
      return "fa-file";
  }
}

export default function DocumentosSection({
  relacion,
  entidadId,
}: {
  relacion: "oportunidad" | "proyecto";
  entidadId: string;
}) {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("OTRO");
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cargar = async () => {
    const param = relacion === "oportunidad" ? "oportunidadId" : "proyectoId";
    const res = await fetch(`/api/documentos?${param}=${entidadId}`);
    const data = await res.json();
    setDocumentos(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    cargar();
  }, [entidadId, relacion]);

  const subir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) return;

    setSubiendo(true);
    setMensaje("");

    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("tipo", tipo);
    formData.append(relacion === "oportunidad" ? "oportunidadId" : "proyectoId", entidadId);
    if (user?.email) formData.append("email", user.email);

    const res = await fetch("/api/documentos", { method: "POST", body: formData });
    setSubiendo(false);

    if (res.ok) {
      setArchivo(null);
      setTipo("OTRO");
      setMensaje("Documento subido correctamente");
      cargar();
    } else {
      const data = await res.json().catch(() => ({}));
      setMensaje(data.error || "Error al subir el documento");
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    const res = await fetch(`/api/documentos/${id}`, { method: "DELETE" });
    if (res.ok) {
      cargar();
    } else {
      setMensaje("Error al eliminar el documento");
    }
  };

  const descargar = (id: string) => {
    window.open(`/api/documentos/${id}/descargar`, "_blank");
  };

  return (
    <div className="glass-card p-6 mt-6">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <i className="fas fa-paperclip text-[var(--data-light)]" />
        Documentos
      </h3>

      <form onSubmit={subir} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold text-white/60 mb-2">ARCHIVO</label>
          <input
            type="file"
            className="input-field text-sm py-3"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            required
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-white/60 mb-2">TIPO</label>
          <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposDocumento.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3 flex items-end">
          <button type="submit" disabled={subiendo} className="btn-primary w-full disabled:opacity-50">
            {subiendo ? (
              <>
                <i className="fas fa-circle-notch fa-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt" />
                Subir
              </>
            )}
          </button>
        </div>
      </form>

      {mensaje && (
        <div className={`mb-4 text-sm p-3 rounded-xl ${mensaje.includes("Error") ? "bg-red-500/10 text-red-300" : "bg-green-500/10 text-green-300"}`}>
          {mensaje}
        </div>
      )}

      {documentos.length === 0 ? (
        <p className="text-white/50 text-sm">No hay documentos adjuntos.</p>
      ) : (
        <div className="space-y-3">
          {documentos.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/[0.07] transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--navy-mid)]/50 flex items-center justify-center text-[var(--data-light)] text-xl">
                <i className={`fas ${iconoPorTipo(d.tipo)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.nombre}</div>
                <div className="text-xs text-white/40 flex flex-wrap gap-3 mt-1">
                  <span>{tiposDocumento.find((t) => t.key === d.tipo)?.label || d.tipo}</span>
                  <span>{formatBytes(d.tamanioBytes)}</span>
                  <span>{new Date(d.createdAt).toLocaleDateString("es-CO")}</span>
                  {d.subidoPor && <span>por {d.subidoPor.nombre}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                <button onClick={() => descargar(d.id)} className="btn-secondary px-3 py-2" title="Descargar">
                  <i className="fas fa-download" />
                </button>
                <button onClick={() => eliminar(d.id)} className="btn-danger px-3 py-2" title="Eliminar">
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
