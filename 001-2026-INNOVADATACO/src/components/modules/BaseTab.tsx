"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  Search,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Calendar,
  Building2,
  Tag,
  Scale,
  Power,
  PowerOff,
  Activity,
  GitBranch,
  Save,
  ChevronRight,
  ChevronDown,
  Eye,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { ENTIDADES_COLOMBIA } from "@/lib/entidadesColombia";
import { SECTORES_COLOMBIA } from "@/lib/sectoresColombia";

type Doc = {
  id: string;
  titulo: string;
  tipo: string;
  entidad: string;
  sector?: string;
  numero?: string;
  fechaExpedicion?: string;
  status: string;
  activo: boolean;
  resumen?: string;
  archivoUrl: string;
  contenidoTexto?: string;
  proposito?: string;
  actores?: string;
  motivacion?: string;
  resuelve?: string;
  jerarquiaNivel: number;
  padreId?: string | null;
  padre?: { id: string; titulo: string; tipo: string } | null;
  createdAt: string;
};

type QueueItem = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  result?: Doc;
  error?: string;
};

const TIPOS = [
  { value: "constitucion", label: "Constitución", nivel: 1 },
  { value: "ley", label: "Ley", nivel: 2 },
  { value: "decreto", label: "Decreto", nivel: 3 },
  { value: "resolucion", label: "Resolución", nivel: 4 },
  { value: "circular", label: "Circular", nivel: 5 },
  { value: "otro", label: "Otro", nivel: 9 },
];

const statusStyles: Record<string, string> = {
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  processing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  needs_review: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-white/5 text-white/40 border-white/10",
};

const statusLabels: Record<string, string> = {
  completed: "Completado",
  processing: "Procesando",
  needs_review: "Revisión",
  pending: "Pendiente",
};

const queueStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploading: "Subiendo",
  processing: "Procesando",
  done: "Listo",
  error: "Error",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO");
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${className}`}>
      {children}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">{label}</h4>
      {children}
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">{label}</label>
      <input
        {...props}
        className={`w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan ${props.className || ""}`}
      />
    </div>
  );
}

function Select({ label, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">{label}</label>
      <select
        {...props}
        className={`w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan ${props.className || ""}`}
      />
    </div>
  );
}

function MetadataForm({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Partial<Doc>;
  onChange: (v: Partial<Doc> | ((prev: Partial<Doc>) => Partial<Doc>)) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Título"
          value={value.titulo || ""}
          onChange={(e) => onChange({ ...value, titulo: e.target.value })}
        />
        <Select
          label="Tipo"
          value={value.tipo || "otro"}
          onChange={(e) => onChange({ ...value, tipo: e.target.value })}
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          label="Entidad"
          value={value.entidad || ""}
          onChange={(e) => onChange({ ...value, entidad: e.target.value })}
        >
          <option value="">Seleccionar</option>
          {ENTIDADES_COLOMBIA.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Select
          label="Sector"
          value={value.sector || ""}
          onChange={(e) => onChange({ ...value, sector: e.target.value })}
        >
          <option value="">Seleccionar</option>
          {SECTORES_COLOMBIA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          label="Número"
          value={value.numero || ""}
          onChange={(e) => onChange({ ...value, numero: e.target.value })}
        />
        <Input
          label="Fecha expedición"
          type="date"
          value={value.fechaExpedicion ? value.fechaExpedicion.slice(0, 10) : ""}
          onChange={(e) => onChange({ ...value, fechaExpedicion: e.target.value })}
        />
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="px-6 py-3 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-30 flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar cambios
      </button>
    </div>
  );
}

function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const processingRef = useRef(false);
  const queueRef = useRef(queue);

  // Sincronizar ref con estado
  queueRef.current = queue;

  const addFiles = (files: FileList | null) => {
    console.log("[useQueue] addFiles llamado", files?.length, "archivos");
    if (!files) return;
    const newItems: QueueItem[] = Array.from(files)
      .filter((f) => f.type === "application/pdf")
      .map((file) => ({ id: Math.random().toString(36).slice(2), file, status: "pending" }));
    console.log("[useQueue] Nuevos items creados:", newItems.map(i => ({ id: i.id, name: i.file.name, status: i.status })));
    setQueue((q) => [...q, ...newItems]);
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    console.log("[useQueue] updateItem:", id, patch);
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const processQueue = async () => {
    console.log("[useQueue] processQueue llamado, processingRef.current:", processingRef.current);
    if (processingRef.current) {
      console.log("[useQueue] Ya hay un procesamiento en curso, saliendo");
      return;
    }
    processingRef.current = true;
    console.log("[useQueue] Iniciando procesamiento de cola");

    while (true) {
      // Usar ref para leer estado actual sincrónicamente
      const currentQueue = queueRef.current;
      console.log("[useQueue] Buscando item pending en cola de", currentQueue.length, "items");

      const next = currentQueue.find((i) => i.status === "pending");
      if (!next) {
        console.log("[useQueue] No hay items pending, terminando");
        break;
      }

      console.log("[useQueue] Item pending encontrado:", next.id, next.file.name);

      // Actualizar estado a uploading
      setQueue((q) => q.map((i) => (i.id === next.id ? { ...i, status: "uploading" } : i)));

      const itemToProcess = next;
      console.log("[useQueue] Procesando item:", itemToProcess.id, itemToProcess.file.name, "tamaño:", itemToProcess.file.size);

      const data = new FormData();
      data.append("file", itemToProcess.file);
      console.log("[useQueue] FormData creado, llamando fetch a /api/documents");

      try {
        const res = await fetch("/api/documents", { method: "POST", body: data });
        console.log("[useQueue] Respuesta recibida:", res.status, res.statusText);

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[useQueue] Error en respuesta:", errorText);
          throw new Error(`Error subiendo documento: ${res.status} ${res.statusText}`);
        }

        const result: Doc = await res.json();
        console.log("[useQueue] Documento procesado exitosamente:", result.id, result.status);
        updateItem(itemToProcess.id, { status: "done", result });
      } catch (err: any) {
        console.error("[useQueue] Error en fetch:", err.message, err);
        updateItem(itemToProcess.id, { status: "error", error: err.message });
      }

      console.log("[useQueue] Item procesado, continuando con siguiente...");
    }

    console.log("[useQueue] Procesamiento de cola terminado");
    processingRef.current = false;
  };

  const removeItem = (id: string) => {
    console.log("[useQueue] removeItem:", id);
    setQueue((q) => q.filter((i) => i.id !== id));
  };

  const clearCompleted = () => {
    console.log("[useQueue] clearCompleted");
    setQueue((q) => q.filter((i) => i.status !== "done"));
  };

  return { queue, addFiles, processQueue, removeItem, clearCompleted, updateItem, setQueue };
}

function useProcessingDocs() {
  const [processingDocs, setProcessingDocs] = useState<Doc[]>([]);
  const [activeModel, setActiveModel] = useState<{ name: string; isLarge: boolean } | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProcessingDocs = async () => {
    console.log("[useProcessingDocs] Fetching documentos en proceso...");
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const allDocs = await res.json();
        // Filtrar solo los que están en queued o processing
        const filtered = allDocs.filter((d: Doc) => d.status === "queued" || d.status === "processing");
        console.log("[useProcessingDocs] Documentos en proceso:", filtered.length);
        setProcessingDocs(filtered);
      }
    } catch (err) {
      console.error("[useProcessingDocs] Error fetching:", err);
    }
  };

  const fetchActiveModel = async () => {
    try {
      const res = await fetch("/api/config/models");
      if (res.ok) {
        const models = await res.json();
        const active = models.find((m: any) => m.active);
        if (active) {
          const isLarge = /32b|70b|8x7b|mixtral|codestral/i.test(active.name);
          setActiveModel({ name: active.name, isLarge });
        }
      }
    } catch (err) {
      console.error("Error fetching active model:", err);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) return;
    console.log("[useProcessingDocs] Iniciando polling");
    pollingRef.current = setInterval(fetchProcessingDocs, 4000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      console.log("[useProcessingDocs] Deteniendo polling");
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    console.log("[useProcessingDocs] Montando componente");
    fetchActiveModel();
    fetchProcessingDocs();
    // Siempre iniciar polling para detectar nuevos documentos
    startPolling();
    return () => stopPolling();
  }, []);

  useEffect(() => {
    const hasProcessing = processingDocs.some((d) => d.status === "queued" || d.status === "processing");
    console.log("[useProcessingDocs] hasProcessing:", hasProcessing, "polling activo:", !!pollingRef.current);
  }, [processingDocs]);

  return { processingDocs, activeModel, refresh: fetchProcessingDocs };
}

function CargaDocumental() {
  const { queue, addFiles, processQueue, removeItem, clearCompleted } = useQueue();
  const { processingDocs, activeModel, refresh: refreshProcessing } = useProcessingDocs();
  const [editingResult, setEditingResult] = useState<Doc | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });
  const [showLargeModelWarning, setShowLargeModelWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveEdited = async () => {
    if (!editingResult) return;

    // Sanitizar fecha antes de enviar
    let fechaExpedicion: string | null = null;
    if (editingResult.fechaExpedicion) {
      try {
        const d = new Date(editingResult.fechaExpedicion);
        fechaExpedicion = isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        fechaExpedicion = null;
      }
    }

    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingResult.id,
        titulo: editingResult.titulo,
        tipo: editingResult.tipo,
        entidad: editingResult.entidad,
        sector: editingResult.sector,
        numero: editingResult.numero,
        fechaExpedicion,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error guardando: ${res.status} ${errText}`);
    }
    const updated: Doc = await res.json();
    setEditingResult(updated);
  };

  useEffect(() => {
    const pending = queue.some((i) => i.status === "pending");
    if (pending) processQueue();
  }, [queue.length]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;

    // Verificar si hay modelo grande activo
    if (activeModel?.isLarge) {
      setShowLargeModelWarning(true);
    }

    addFiles(files);
  };

  const handleProcessQueue = async () => {
    const initialQueueLength = queue.filter((i) => i.status === "pending").length;

    await processQueue();

    // Mostrar mensaje de éxito
    if (initialQueueLength > 0) {
      setUploadSuccess({ show: true, count: initialQueueLength });
      refreshProcessing();

      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        setUploadSuccess({ show: false, count: 0 });
      }, 5000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Upload className="w-3 h-3" /> Base Oficial
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Carga documental</h1>
      </header>

      {/* Mensaje de éxito de subida */}
      {uploadSuccess.show && (
        <div className="glass-panel p-4 border border-green-500/30 bg-green-500/5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-bold text-green-400">
                {uploadSuccess.count} documento{uploadSuccess.count > 1 ? "s" : ""} en cola de procesamiento
              </p>
              <p className="text-[10px] text-foreground/50">
                Puedes salir de esta página. El procesamiento continuará en segundo plano.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advertencia de modelo grande */}
      {showLargeModelWarning && (
        <div className="glass-panel p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-400">Procesamiento con modelo grande detectado</p>
              <p className="text-[10px] text-foreground/50 mt-1">
                Estás usando <strong>{activeModel?.name}</strong>. El procesamiento puede tardar varios minutos por documento.
                Los documentos se procesarán en segundo plano.
              </p>
              <button
                onClick={() => setShowLargeModelWarning(false)}
                className="text-[9px] text-amber-400 hover:text-amber-300 mt-2 underline"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleAddFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-white/10 hover:border-neonCyan/30 rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleAddFiles(e.target.files)}
        />
        <div className="p-4 rounded-full bg-white/5 text-foreground/30">
          <Upload className="w-6 h-6" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold">Arrastra PDFs o haz clic para seleccionar</p>
          <p className="text-[10px] text-foreground/30 uppercase tracking-widest mt-1">Cola de carga en background</p>
        </div>
      </div>

      {/* Cola local de archivos por subir */}
      {queue.length > 0 && (
        <div className="glass-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/30">
              <FileText className="w-3 h-3" /> Por subir ({queue.length})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleProcessQueue}
                disabled={queue.every((i) => i.status !== "pending")}
                className="px-3 py-1.5 bg-neonCyan text-black font-black text-[9px] uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-30"
              >
                {queue.some((i) => i.status === "uploading") ? "Subiendo..." : "Subir documentos"}
              </button>
              <button
                onClick={clearCompleted}
                className="px-3 py-1.5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                Limpiar listos
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.status === "uploading" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neonCyan shrink-0" />
                  ) : item.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : item.status === "error" ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-foreground/30 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{item.file.name}</p>
                    <p className={`text-[9px] uppercase tracking-wider ${item.status === "error" ? "text-red-400" : "text-foreground/30"}`}>
                      {queueStatusLabels[item.status]}
                    </p>
                    {item.error && <p className="text-[9px] text-red-400 truncate" title={item.error}>{item.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "done" && item.result && (
                    <button
                      onClick={() => setEditingResult(item.result!)}
                      className="p-1.5 text-neonCyan hover:bg-neonCyan/10"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-foreground/30 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentos en procesamiento (desde BD con polling) */}
      {processingDocs.length > 0 && (
        <div className="glass-panel p-4 space-y-4 border border-neonCyan/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neonCyan">
              <Loader2 className="w-3 h-3 animate-spin" /> En procesamiento ({processingDocs.length})
            </div>
            <div className="flex items-center gap-2">
              {activeModel?.isLarge && (
                <span className="text-[9px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                  Modelo grande: puede tardar varios minutos
                </span>
              )}
              <button
                onClick={refreshProcessing}
                className="p-1.5 text-foreground/30 hover:text-neonCyan"
                title="Actualizar ahora"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {processingDocs.map((doc) => {
              const minutosEnCola = Math.floor((Date.now() - new Date(doc.createdAt).getTime()) / 60000);
              const estaEstancado = doc.status === "queued" && minutosEnCola > 10;
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-neonCyan shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate">{doc.titulo}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] uppercase tracking-wider text-foreground/30">
                          {doc.status === "queued" ? "En cola" : "Procesando con IA..."}
                        </p>
                        {activeModel?.isLarge && !estaEstancado && (
                          <span className="text-[9px] text-amber-400">⏱️ Estimado: 2-5 min</span>
                        )}
                      </div>
                      {estaEstancado && (
                        <div className="mt-1 p-1.5 bg-red-500/10 border border-red-500/20 rounded">
                          <p className="text-[9px] text-red-400 font-bold">
                            ⚠️ El procesamiento parece detenido — verifica que el worker esté corriendo
                          </p>
                          <p className="text-[9px] text-red-400/70">
                            (npm run status)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-foreground/30 text-center">
            Actualizando automáticamente cada 4 segundos...
          </p>
        </div>
      )}

      {editingResult && (
        <div className="glass-panel p-6 space-y-4 border border-neonCyan/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" /> Documento procesado por IA
            </div>
            <button onClick={() => setEditingResult(null)} className="text-foreground/30 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-foreground/30 uppercase tracking-widest">
            Revisa y corrige los datos extraídos antes de guardar.
          </p>
          <MetadataForm
            value={editingResult}
            onChange={(v) => setEditingResult((prev) => (prev ? { ...prev, ...v as Doc } : null))}
            onSave={saveEdited}
          />
        </div>
      )}
    </div>
  );
}

function GraphView({ docs }: { docs: Doc[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const initial: Record<string, { x: number; y: number }> = {};
    const centerX = 400;
    const centerY = 250;
    docs.forEach((doc, i) => {
      const angle = (i / Math.max(1, docs.length)) * Math.PI * 2;
      const radius = 180;
      initial[doc.id] = { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    });
    setNodes(initial);
  }, [docs.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    docs.forEach((doc) => {
      const node = nodes[doc.id];
      if (!node) return;
      if (doc.padreId && nodes[doc.padreId]) {
        const parent = nodes[doc.padreId];
        ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
    });

    docs.forEach((doc) => {
      const node = nodes[doc.id];
      if (!node) return;
      ctx.fillStyle = "#00F0FF";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "10px sans-serif";
      ctx.fillText(doc.titulo.slice(0, 24), node.x + 10, node.y + 3);
    });
  }, [docs, nodes]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const doc of docs) {
      const node = nodes[doc.id];
      if (!node) continue;
      if (Math.hypot(node.x - x, node.y - y) < 15) {
        setDragging(doc.id);
        setOffset({ x: x - node.x, y: y - node.y });
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - offset.x;
    const y = e.clientY - rect.top - offset.y;
    setNodes((n) => ({ ...n, [dragging]: { x, y } }));
  };

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/30">
        <GitBranch className="w-3 h-3" /> Grafo de relaciones
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="w-full h-[320px] bg-black/20 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      />
      <p className="text-[9px] text-foreground/30 uppercase tracking-wider">
        Arrastra los nodos. Líneas = relaciones jerárquicas padre-hijo.
      </p>
    </div>
  );
}

function HierarchyView({ docs }: { docs: Doc[] }) {
  const roots = useMemo(() => docs.filter((d) => !d.padreId), [docs]);
  const byParent = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    docs.forEach((d) => {
      if (d.padreId) {
        map[d.padreId] = map[d.padreId] || [];
        map[d.padreId].push(d);
      }
    });
    return map;
  }, [docs]);

  const TreeNode = ({ doc, level = 0 }: { doc: Doc; level?: number }) => {
    const [open, setOpen] = useState(true);
    const children = byParent[doc.id] || [];
    return (
      <div className="select-none" style={{ marginLeft: level * 20 }}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 py-1 text-[11px] hover:text-neonCyan text-left"
        >
          {children.length > 0 ? (
            open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
            <span className="w-3" />
          )}
          <span className="truncate">{doc.titulo}</span>
        </button>
        {open && children.map((child) => <TreeNode key={child.id} doc={child} level={level + 1} />)}
      </div>
    );
  };

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/30">
        <Scale className="w-3 h-3" /> Jerarquía normativa
      </div>
      <div className="max-h-64 overflow-y-auto">
        {roots.length === 0 && <p className="text-[10px] text-foreground/30">Sin raíces definidas</p>}
        {roots.map((doc) => (
          <TreeNode key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}

function BusquedaRag() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ tipo: "", entidad: "", sector: "", fechaDesde: "", fechaHasta: "" });
  const [results, setResults] = useState<(Doc & { score: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<"list" | "graph" | "hierarchy">("list");
  const [allDocs, setAllDocs] = useState<Doc[]>([]);

  const fetchDocs = async () => {
    const res = await fetch("/api/documents");
    if (res.ok) setAllDocs(await res.json());
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, ...filters }),
      });
      if (!res.ok) throw new Error("Error en búsqueda");
      setResults(await res.json());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const displayDocs = view === "list" ? results : allDocs;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Search className="w-3 h-3" /> Base Oficial
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Búsqueda RAG</h1>
      </header>

      <form onSubmit={handleSearch} className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2 text-foreground/30 text-[10px] font-black uppercase tracking-widest">
          <Search className="w-3 h-3" /> Consulta libre + filtros
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe lo que necesitas encontrar en los documentos oficiales..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 p-4 text-xs outline-none focus:border-neonCyan resize-none"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select label="Tipo" value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select label="Entidad" value={filters.entidad} onChange={(e) => setFilters({ ...filters, entidad: e.target.value })}>
            <option value="">Todas</option>
            {ENTIDADES_COLOMBIA.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Select label="Sector" value={filters.sector} onChange={(e) => setFilters({ ...filters, sector: e.target.value })}>
            <option value="">Todos</option>
            {SECTORES_COLOMBIA.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input label="Desde" type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
          <Input label="Hasta" type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-6 py-3 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-30 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      <div className="flex items-center gap-2">
        {(["list", "graph", "hierarchy"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border ${view === v ? "border-neonCyan text-neonCyan" : "border-white/10 text-foreground/30 hover:text-white"
              }`}
          >
            {v === "list" ? "Lista" : v === "graph" ? "Grafo" : "Jerarquía"}
          </button>
        ))}
      </div>

      {view === "graph" && <GraphView docs={allDocs} />}
      {view === "hierarchy" && <HierarchyView docs={allDocs} />}

      {view === "list" && (
        <>
          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-foreground/20 gap-3">
              <Search className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sin resultados para esta consulta</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {results.map((doc) => (
              <div key={doc.id} className="glass-panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Badge className="text-neonCyan border-neonCyan/20">
                      {TIPOS.find((t) => t.value === doc.tipo)?.label || doc.tipo}
                    </Badge>
                    <h3 className="text-sm font-bold uppercase tracking-tight">{doc.titulo}</h3>
                  </div>
                  <div className="text-[10px] font-black text-neonCyan">Score {doc.score}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-foreground/40">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{doc.entidad || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    <span className="truncate">{doc.sector || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(doc.fechaExpedicion)}</span>
                  </div>
                </div>
                {doc.resumen && <p className="text-[11px] text-foreground/50 line-clamp-3 leading-relaxed">{doc.resumen}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {(view === "graph" || view === "hierarchy") && displayDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-foreground/20 gap-3">
          <GitBranch className="w-8 h-8" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sin documentos activos</span>
        </div>
      )}
    </div>
  );
}

function DocumentLogs({ docId }: { docId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${docId}/logs`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [docId]);

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-foreground/30" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/30">
        <Activity className="w-3 h-3" /> Log de transacciones
      </div>
      {logs.length === 0 && <p className="text-[10px] text-foreground/30">Sin registros</p>}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 text-[10px]">
            <div className="shrink-0">
              {log.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
                log.status === "error" ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> :
                  <Loader2 className="w-3.5 h-3.5 text-amber-400" />}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black uppercase tracking-wider">{log.action}</span>
                <span className="text-foreground/30">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="text-foreground/60">{log.message}</p>
              {log.aiModel && <p className="text-neonCyan">Modelo: {log.aiModel.name} ({log.aiModel.provider})</p>}
              {log.userId && <p className="text-foreground/30">Ejecutado por: {log.userId}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Repositorio() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState<Doc | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?includeInactive=${showInactive}`);
      if (!res.ok) throw new Error("Error cargando documentos");
      setDocs(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [showInactive]);

  const toggleActivo = async (doc: Doc) => {
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, activo: !doc.activo }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setDocs((d) => d.map((x) => (x.id === updated.id ? updated : x)));
    if (selected?.id === updated.id) setSelected(updated);
  };

  const saveEditing = async () => {
    if (!editing) return;
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        titulo: editing.titulo,
        tipo: editing.tipo,
        entidad: editing.entidad,
        sector: editing.sector,
        numero: editing.numero,
        fechaExpedicion: editing.fechaExpedicion,
      }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setDocs((d) => d.map((x) => (x.id === updated.id ? updated : x)));
    setEditing(null);
    if (selected?.id === updated.id) setSelected(updated);
  };

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filterTipo && d.tipo !== filterTipo) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      return true;
    });
  }, [docs, filterTipo, filterStatus]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
            <Database className="w-3 h-3" /> Base Oficial
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Repositorio</h1>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-foreground/30 uppercase tracking-widest">
          <span>{docs.filter((d) => d.activo).length} activos</span>
          <span>{docs.filter((d) => !d.activo).length} inactivos</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 p-4 glass-panel rounded-xl">
        <div className="flex items-center gap-2 text-foreground/30">
          <Filter className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-widest">Filtros</span>
        </div>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="bg-white/5 border border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white/5 border border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider"
        >
          <option value="">Todos los estados</option>
          <option value="completed">Completado</option>
          <option value="processing">Procesando</option>
          <option value="needs_review">Revisión</option>
          <option value="pending">Pendiente</option>
        </select>
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-neonCyan"
          />
          Ver inactivos
        </label>
        <button
          onClick={() => {
            setFilterTipo("");
            setFilterStatus("");
          }}
          className="text-[9px] font-black uppercase tracking-widest text-foreground/30 hover:text-neonCyan"
        >
          Limpiar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 gap-3 text-foreground/30">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest">Cargando repositorio...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-[11px]">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-foreground/20 gap-3">
          <FileText className="w-10 h-10" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sin documentos registrados</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className={`text-left glass-panel p-4 space-y-3 transition-colors ${doc.activo ? "hover:border-neonCyan/30" : "opacity-50 border-white/5"
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <button onClick={() => setSelected(doc)} className="space-y-1 text-left flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-neonCyan border-neonCyan/20">
                    {TIPOS.find((t) => t.value === doc.tipo)?.label || doc.tipo}
                  </Badge>
                  <Badge className={statusStyles[doc.status] || statusStyles.pending}>
                    {statusLabels[doc.status] || doc.status}
                  </Badge>
                  {!doc.activo && <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Inactivo</Badge>}
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">{doc.titulo}</h3>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(doc)}
                  className="p-1.5 text-neonCyan hover:bg-neonCyan/10"
                  title="Editar"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleActivo(doc)}
                  className={`p-1.5 ${doc.activo ? "text-green-400 hover:bg-green-500/10" : "text-red-400 hover:bg-red-500/10"}`}
                  title={doc.activo ? "Desactivar" : "Activar"}
                >
                  {doc.activo ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button onClick={() => setSelected(doc)} className="w-full text-left">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-foreground/40">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{doc.entidad || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  <span className="truncate">{doc.sector || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(doc.fechaExpedicion)}</span>
                </div>
              </div>
              {doc.resumen && <p className="text-[11px] text-foreground/50 line-clamp-2 leading-relaxed">{doc.resumen}</p>}
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-foreground/30 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-neonCyan border-neonCyan/20">
                  {TIPOS.find((t) => t.value === selected.tipo)?.label || selected.tipo}
                </Badge>
                <Badge className={statusStyles[selected.status] || statusStyles.pending}>
                  {statusLabels[selected.status] || selected.status}
                </Badge>
                {selected.activo ? (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Activo</Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Inactivo</Badge>
                )}
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">{selected.titulo}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px]">
              <Section label="Entidad">
                <p className="text-foreground/70">{selected.entidad || "—"}</p>
              </Section>
              <Section label="Sector">
                <p className="text-foreground/70">{selected.sector || "—"}</p>
              </Section>
              <Section label="Fecha expedición">
                <p className="text-foreground/70">{formatDate(selected.fechaExpedicion)}</p>
              </Section>
              <Section label="Número">
                <p className="text-foreground/70">{selected.numero || "—"}</p>
              </Section>
              <Section label="Jerarquía">
                <p className="text-foreground/70">Nivel {selected.jerarquiaNivel}</p>
              </Section>
              <Section label="Archivo">
                <a href={selected.archivoUrl} target="_blank" rel="noreferrer" className="text-neonCyan hover:underline">
                  Descargar PDF
                </a>
              </Section>
            </div>
            {selected.resumen && (
              <Section label="Resumen">
                <p className="text-[11px] text-foreground/60 leading-relaxed">{selected.resumen}</p>
              </Section>
            )}
            {selected.proposito && (
              <Section label="Propósito">
                <p className="text-[11px] text-foreground/60 leading-relaxed">{selected.proposito}</p>
              </Section>
            )}
            {selected.actores && (
              <Section label="Actores">
                <p className="text-[11px] text-foreground/60 leading-relaxed">{selected.actores}</p>
              </Section>
            )}
            {selected.motivacion && (
              <Section label="Motivación">
                <p className="text-[11px] text-foreground/60 leading-relaxed">{selected.motivacion}</p>
              </Section>
            )}
            {selected.resuelve && (
              <Section label="Resuelve">
                <p className="text-[11px] text-foreground/60 leading-relaxed">{selected.resuelve}</p>
              </Section>
            )}
            <DocumentLogs docId={selected.id} />
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 relative">
            <button
              onClick={() => setEditing(null)}
              className="absolute top-4 right-4 text-foreground/30 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold uppercase tracking-tight">Editar documento</h2>
            <MetadataForm
              value={editing}
              onChange={(v) => setEditing((prev) => (prev ? { ...prev, ...v as Doc } : null))}
              onSave={saveEditing}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BaseTab({ submoduleId }: { submoduleId: string }) {
  if (submoduleId === "carga_documental") return <CargaDocumental />;
  if (submoduleId === "busqueda_rag") return <BusquedaRag />;
  return <Repositorio />;
}
