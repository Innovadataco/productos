"use client";

import { useEffect, useMemo, useState } from "react";
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
  resumen?: string;
  archivoUrl: string;
  contenidoTexto?: string;
  proposito?: string;
  actores?: string;
  motivacion?: string;
  resuelve?: string;
  jerarquiaNivel: number;
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
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

function Repositorio() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState<Doc | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
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
  }, []);

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
        <div className="text-[10px] text-foreground/30 uppercase tracking-widest">
          {docs.length} documento{docs.length !== 1 ? "s" : ""} indexado{docs.length !== 1 ? "s" : ""}
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
          <button
            key={doc.id}
            onClick={() => setSelected(doc)}
            className="text-left glass-panel p-4 space-y-3 hover:border-neonCyan/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-neonCyan border-neonCyan/20">
                    {TIPOS.find((t) => t.value === doc.tipo)?.label || doc.tipo}
                  </Badge>
                  <Badge className={statusStyles[doc.status] || statusStyles.pending}>
                    {statusLabels[doc.status] || doc.status}
                  </Badge>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">{doc.titulo}</h3>
              </div>
              {doc.jerarquiaNivel <= 3 && <Scale className="w-4 h-4 text-neonCyan/40 shrink-0" />}
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
            {doc.resumen && <p className="text-[11px] text-foreground/50 line-clamp-2 leading-relaxed">{doc.resumen}</p>}
          </button>
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
                <a
                  href={selected.archivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neonCyan hover:underline"
                >
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
          </div>
        </div>
      )}
    </div>
  );
}

function CargaDocumental() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Doc | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "otro",
    entidad: "",
    sector: "",
    numero: "",
    fechaExpedicion: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    try {
      const res = await fetch("/api/documents", { method: "POST", body: data });
      if (!res.ok) throw new Error("Error subiendo documento");
      setResult(await res.json());
      setFile(null);
      setForm({ titulo: "", tipo: "otro", entidad: "", sector: "", numero: "", fechaExpedicion: "" });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
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

      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-6">
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors ${
            file ? "border-neonCyan/40 bg-neonCyan/5" : "border-white/10 hover:border-neonCyan/30"
          }`}
        >
          <input
            type="file"
            accept=".pdf"
            id="doc-upload"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-3 text-center">
            <div className="p-4 rounded-full bg-white/5 text-foreground/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold">{file ? file.name : "Arrastra o selecciona un PDF oficial"}</p>
              <p className="text-[10px] text-foreground/30 uppercase tracking-widest mt-1">
                Máx 10MB · PDF
              </p>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Opcional: se extrae del PDF"
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Entidad</label>
            <select
              value={form.entidad}
              onChange={(e) => setForm({ ...form, entidad: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            >
              <option value="">Seleccionar</option>
              {ENTIDADES_COLOMBIA.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Sector</label>
            <select
              value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            >
              <option value="">Seleccionar</option>
              {SECTORES_COLOMBIA.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Número</label>
            <input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="Ej: 123 de 2024"
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Fecha expedición</label>
            <input
              type="date"
              value={form.fechaExpedicion}
              onChange={(e) => setForm({ ...form, fechaExpedicion: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-3 text-xs outline-none focus:border-neonCyan"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-4 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Procesando documento..." : "Subir y procesar con IA"}
        </button>
      </form>

      {result && (
        <div className="glass-panel p-6 space-y-4 border-l-2 border-l-green-500">
          <div className="flex items-center gap-2 text-green-400 text-[10px] font-black uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" /> Documento procesado
          </div>
          <h3 className="text-sm font-bold uppercase">{result.titulo}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px]">
            <Section label="Entidad">
              <p className="text-foreground/70">{result.entidad || "—"}</p>
            </Section>
            <Section label="Sector">
              <p className="text-foreground/70">{result.sector || "—"}</p>
            </Section>
            <Section label="Estado">
              <p className="text-foreground/70">{statusLabels[result.status] || result.status}</p>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function BusquedaRag() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Doc & { score: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Error en búsqueda");
      setResults(await res.json());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <Search className="w-3 h-3" /> Consulta semántica
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe lo que necesitas encontrar en los documentos oficiales..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 p-4 text-xs outline-none focus:border-neonCyan resize-none"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-6 py-3 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-30 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

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
    </div>
  );
}

export default function BaseTab({ submoduleId }: { submoduleId: string }) {
  if (submoduleId === "carga_documental") return <CargaDocumental />;
  if (submoduleId === "busqueda_rag") return <BusquedaRag />;
  return <Repositorio />;
}
