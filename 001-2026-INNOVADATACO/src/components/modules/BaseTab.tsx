"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Database,
  Search,
  FileText,
  Upload,
  X,
  FolderTree,
  Scale,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileDigit,
  ScrollText,
  Landmark,
  Gavel,
  BookOpen,
  CircleHelp,
} from "lucide-react";
import { ENTIDADES_COLOMBIA } from "@/lib/entidadesColombia";
import { SECTORES_COLOMBIA } from "@/lib/sectoresColombia";

interface Documento {
  id: string;
  titulo: string;
  tipo: string;
  sector?: string;
  entidad: string;
  status?: string;
  processingError?: string | null;
  fechaExpedicion?: string;
  numero?: string;
  archivoUrl: string;
  contenidoTexto: string;
  resumen: string;
  proposito: string;
  actores: string;
  motivacion: string;
  resuelve: string;
  jerarquiaNivel: number;
  padreId?: string | null;
  padre?: { id: string; titulo: string; tipo: string } | null;
}

const TIPOS = [
  { value: "ley", label: "Ley", nivel: 2 },
  { value: "decreto", label: "Decreto", nivel: 3 },
  { value: "resolucion", label: "Resoluci\u00f3n", nivel: 4 },
  { value: "circular", label: "Circular", nivel: 5 },
  { value: "otro", label: "Otro", nivel: 9 },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

const TIPO_ICONS: Record<string, React.ReactNode> = {
  ley: <Landmark className="w-5 h-5" />,
  decreto: <Gavel className="w-5 h-5" />,
  resolucion: <ScrollText className="w-5 h-5" />,
  circular: <BookOpen className="w-5 h-5" />,
  otro: <FileDigit className="w-5 h-5" />,
};

export default function BaseTab() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [selected, setSelected] = useState<Documento | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; msg: string } | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Documento[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [form, setForm] = useState({
    titulo: "",
    tipo: "resolucion",
    sector: SECTORES_COLOMBIA[0],
    entidad: ENTIDADES_COLOMBIA[0],
    fechaExpedicion: "",
    numero: "",
    padreId: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocs(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setStatus({ type: "info", msg: "Extrayendo texto y metadatos del PDF..." });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("titulo", form.titulo);
      fd.append("tipo", form.tipo);
      fd.append("sector", form.sector);
      fd.append("entidad", form.entidad);
      fd.append("fechaExpedicion", form.fechaExpedicion);
      fd.append("numero", form.numero);
      fd.append("padreId", form.padreId);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFile(null);
      setForm({
        titulo: "",
        tipo: "resolucion",
        sector: SECTORES_COLOMBIA[0],
        entidad: ENTIDADES_COLOMBIA[0],
        fechaExpedicion: "",
        numero: "",
        padreId: "",
      });
      await load();
      setStatus({
        type: "success",
        msg: `Documento procesado: ${data.titulo} \u2022 ${data.entidad} \u2022 ${data.sector || "Sin sector"} \u2022 ${data.numero || "sin n\u00famero"}`,
      });
      setTimeout(() => setStatus(null), 5000);
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "Error al procesar" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const res = await fetch("/api/documents/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: search }),
    });
    setResults(await res.json());
  };

  const jerarquia = useMemo(() => [...docs].sort((a, b) => a.jerarquiaNivel - b.jerarquiaNivel), [docs]);

  const highlightedText = useMemo(() => {
    if (!selected || !docSearch.trim()) return selected?.contenidoTexto || "";
    const text = selected.contenidoTexto;
    const term = docSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(${term})`, "gi"), "**$1**");
  }, [selected, docSearch]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Database className="w-3 h-3" /> Repositorio
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Base Oficial</h1>
      </header>

      {/* UPLOAD */}
      <form onSubmit={handleUpload} className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-neonCyan/10 flex items-center justify-center text-neonCyan">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase">Cargar documento oficial</h3>
            <p className="text-[10px] text-[#444] uppercase tracking-widest">PDF // Clasificaci\u00f3n autom\u00e1tica</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="md:col-span-4 text-[10px] file:bg-white/5 file:border file:border-white/10 file:text-white file:px-3 file:py-2 file:mr-3"
          />
          <input placeholder="T\u00edtulo (o se extrae del PDF)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs">
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-2">
            {SECTORES_COLOMBIA.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-2">
            {ENTIDADES_COLOMBIA.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <input type="date" value={form.fechaExpedicion} onChange={(e) => setForm({ ...form, fechaExpedicion: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
          <input placeholder="N\u00famero (o se extrae del PDF)" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
          <select value={form.padreId} onChange={(e) => setForm({ ...form, padreId: e.target.value })} className="md:col-span-2 bg-white/5 border border-white/10 p-2 text-xs">
            <option value="">Sin documento padre (jerarqu\u00eda)</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{TIPO_LABELS[d.tipo] || d.tipo} - {d.titulo}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="flex items-center gap-2 px-4 py-2 bg-neonCyan text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-30"
        >
          {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Procesando...</> : <><Upload className="w-3 h-3" /> Procesar PDF</>}
        </button>

        {status && (
          <div className={`flex items-center gap-2 text-[10px] uppercase tracking-widest ${
            status.type === "success" ? "text-green-400" : status.type === "error" ? "text-red-400" : "text-neonCyan"
          }`}>
            {status.type === "success" ? <CheckCircle className="w-3 h-3" /> : status.type === "error" ? <AlertCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            {status.msg}
          </div>
        )}
      </form>

      {/* RAG SEARCH */}
      <form onSubmit={handleSearch} className="flex items-center gap-4 py-4 border-y border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Consultar la base de conocimiento oficial..."
            className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-4 text-xs font-geist-mono focus:outline-none focus:border-neonCyan transition-colors"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:border-neonCyan">Buscar</button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neonCyan">Resultados RAG</h4>
          {results.map((r) => (
            <div key={r.id} onClick={() => setSelected(r)} className="glass-panel p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">{r.titulo}</span>
                <span className="text-[9px] text-[#444] uppercase">{TIPO_LABELS[r.tipo] || r.tipo}</span>
              </div>
              <p className="text-[10px] text-[#666] line-clamp-2 mt-1">{r.resumen}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTADO */}
        <div className="lg:col-span-2 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neonCyan flex items-center gap-2"><FileText className="w-3 h-3" /> Documentos</h4>
          {docs.map((doc) => (
            <div key={doc.id} onClick={() => { setSelected(doc); setDocSearch(""); }} className={`glass-panel p-4 cursor-pointer transition-colors ${selected?.id === doc.id ? "border-neonCyan/30 bg-neonCyan/5" : "hover:bg-white/[0.02]"}`}>
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-neonCyan/70">
                  {TIPO_ICONS[doc.tipo] || <CircleHelp className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 border border-white/10 shrink-0">{TIPO_LABELS[doc.tipo] || doc.tipo}</span>
                      {doc.status === "completed" ? <span className="text-[8px] text-green-400 uppercase shrink-0">OK</span> : doc.status === "needs_review" ? <span className="text-[8px] text-amber-400 uppercase shrink-0">Revisar</span> : doc.status === "processing" ? <span className="text-[8px] text-neonCyan uppercase shrink-0">Procesando</span> : <span className="text-[8px] text-[#444] uppercase shrink-0">{doc.status}</span>}
                      <span className="text-xs font-bold uppercase truncate">{doc.titulo}</span>
                    </div>
                    {doc.padre && <span className="text-[9px] text-[#444] shrink-0">hijo de {doc.padre.titulo}</span>}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[9px] text-[#666] mt-1 uppercase tracking-wider">
                    {doc.sector && <span className="text-neonCyan/70">{doc.sector}</span>}
                    <span>{doc.entidad}</span>
                    {doc.numero && <span>No. {doc.numero}</span>}
                    {doc.fechaExpedicion && <span>{new Date(doc.fechaExpedicion).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* JERARQU\u00cdA */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neonCyan flex items-center gap-2"><FolderTree className="w-3 h-3" /> Jerarqu\u00eda Normativa</h4>
          <div className="glass-panel p-4 space-y-3">
            {jerarquia.map((doc, i) => (
              <div key={doc.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-neonCyan" />
                  {i < jerarquia.length - 1 && <div className="w-px h-full bg-white/10 mt-1" />}
                </div>
                <div className="pb-4">
                  <span className="text-[9px] font-black text-[#444] uppercase">{TIPO_LABELS[doc.tipo] || doc.tipo}</span>
                  <p className="text-[10px] font-bold uppercase">{doc.titulo}</p>
                </div>
              </div>
            ))}
            {jerarquia.length === 0 && <p className="text-[10px] text-[#444] uppercase">Sin documentos</p>}
          </div>

          <div className="glass-panel p-4 flex items-start gap-3">
            <Scale className="w-4 h-4 text-neonCyan shrink-0" />
            <div>
              <h5 className="text-[10px] font-black uppercase">Orden jer\u00e1rquico</h5>
              <p className="text-[9px] text-[#444] uppercase tracking-widest mt-1">Ley &gt; Decreto &gt; Resoluci\u00f3n &gt; Circular. Los documentos inferiores no pueden contradecir a sus padres.</p>
            </div>
          </div>
        </div>
      </div>

      {/* DETALLE */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#050505] border border-white/10 w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-start gap-4">
                <div className="text-neonCyan mt-1">{TIPO_ICONS[selected.tipo] || <CircleHelp className="w-6 h-6" />}</div>
                <div>
                  <h2 className="text-xl font-bold uppercase">{selected.titulo}</h2>
                  <div className="flex items-center flex-wrap gap-4 text-[10px] uppercase text-[#666] mt-1">
                    <span>{TIPO_LABELS[selected.tipo] || selected.tipo}</span>
                    {selected.sector && <span className="text-neonCyan/70">{selected.sector}</span>}
                    <span>{selected.entidad}</span>
                    {selected.numero && <span>No. {selected.numero}</span>}
                    {selected.fechaExpedicion && <span>{new Date(selected.fechaExpedicion).toLocaleDateString()}</span>}
                    {selected.status === "needs_review" && <span className="text-amber-400">Revisión requerida</span>}
                  </div>
                  {selected.processingError && (
                    <div className="mt-2 text-[9px] text-amber-400 bg-amber-400/5 border border-amber-400/20 p-2 rounded">
                      {selected.processingError}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* METADATA */}
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 p-6 space-y-6 overflow-y-auto">
                {[
                  { label: "Prop\u00f3sito", value: selected.proposito },
                  { label: "Actores involucrados", value: selected.actores },
                  { label: "Motivaci\u00f3n", value: selected.motivacion },
                  { label: "Resuelve", value: selected.resuelve },
                  { label: "Resumen", value: selected.resumen },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <h5 className="text-[10px] font-black uppercase text-neonCyan">{item.label}</h5>
                    <p className="text-[11px] text-[#aaa] leading-relaxed whitespace-pre-line">{item.value || "No identificado"}</p>
                  </div>
                ))}
              </div>

              {/* FULL TEXT */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-white/10 flex items-center gap-3">
                  <Search className="w-4 h-4 text-[#444]" />
                  <input
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Buscar dentro del documento..."
                    className="flex-1 bg-white/5 border border-white/10 p-2 text-xs focus:outline-none focus:border-neonCyan"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-6 font-geist-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#bbb]">
                  {highlightedText.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <mark key={i} className="bg-neonCyan/30 text-white px-0.5">{part.slice(2, -2)}</mark>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
