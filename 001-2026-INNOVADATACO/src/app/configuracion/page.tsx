"use client";

import { useEffect, useState } from "react";
import {
  Settings, Cpu, Globe, Activity, Save, Plus, Trash2, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Clock, Terminal, X
} from "lucide-react";

interface AiModel {
  id: string;
  name: string;
  provider: "ollama" | "openai" | "mock";
  baseUrl: string | null;
  apiKey: string | null;
  modelPath: string;
  country: string | null;
  active: boolean;
  config: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  status: "success" | "error" | "info";
  message: string;
  latencyMs: number | null;
  createdAt: string;
  aiModel: { name: string; provider: string } | null;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

const PROVIDERS = [
  { value: "ollama", label: "Ollama (local)" },
  { value: "openai", label: "OpenAI" },
  { value: "mock", label: "Mock (pruebas)" },
];

const DEFAULT_CONFIG = { temperature: 0.2, top_p: 0.9, max_tokens: 1024, systemPrompt: "Eres un asistente experto en documentos legales colombianos. Responde \u00daNICAMENTE con JSON v\u00e1lido." };

const emptyForm = (): Partial<AiModel> => ({
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  modelPath: "qwen2.5",
  active: true,
  config: JSON.stringify(DEFAULT_CONFIG, null, 2),
});

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<"models" | "apis" | "params" | "audit">("models");
  const [models, setModels] = useState<AiModel[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AiModel>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [discovered, setDiscovered] = useState<{ name: string; model: string; parameter_size?: string }[]>([]);
  const [discovering, setDiscovering] = useState(false);

  const toast = (type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const loadModels = async () => {
    const res = await fetch("/api/config/models");
    setModels(await res.json());
  };

  const loadAudit = async () => {
    const res = await fetch("/api/config/audit?limit=100");
    setLogs(await res.json());
  };

  useEffect(() => {
    loadModels();
    loadAudit();
  }, []);

  const saveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        config: typeof form.config === "string" ? form.config : JSON.stringify(form.config),
      };
      const url = editingId ? `/api/config/models/${editingId}` : "/api/config/models";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(err.error || "Error guardando");
      }
      setEditingId(null);
      setForm(emptyForm());
      await loadModels();
      await loadAudit();
      toast("success", editingId ? "Modelo actualizado" : "Modelo creado");
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const testModel = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/config/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) toast("success", `Test OK ${data.latencyMs}ms`);
      else toast("error", `Test fallido: ${data.error}`);
      await loadAudit();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setTestingId(null);
    }
  };

  const deleteModel = async (id: string) => {
    if (!confirm("Eliminar modelo?")) return;
    try {
      const res = await fetch(`/api/config/models/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando");
      await loadModels();
      await loadAudit();
      toast("success", "Modelo eliminado");
    } catch (err: any) {
      toast("error", err.message);
    }
  };

  const editModel = (m: AiModel) => {
    setEditingId(m.id);
    setForm({ ...m, config: typeof m.config === "string" ? m.config : JSON.stringify(m.config, null, 2) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDiscovered([]);
  };

  const discoverModels = async () => {
    if (form.provider !== "ollama") return;
    setDiscovering(true);
    try {
      const baseUrl = form.baseUrl || "http://localhost:11434";
      const res = await fetch(`/api/config/models/discover?baseUrl=${encodeURIComponent(baseUrl)}`);
      const data = await res.json();
      if (data.models?.length) {
        setDiscovered(data.models);
        toast("success", `${data.models.length} modelos locales encontrados`);
      } else {
        setDiscovered([]);
        toast("error", data.error || "No se encontraron modelos locales");
      }
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: typeof tab; label: string; icon: any }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
        tab === id ? "border-neonCyan text-neonCyan" : "border-transparent text-white/30 hover:text-white"
      }`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider border ${t.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : t.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-neonCyan/30 bg-neonCyan/10 text-neonCyan"}`}>
            {t.type === "success" ? <CheckCircle className="w-3 h-3" /> : t.type === "error" ? <XCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {t.message}
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Settings className="w-3 h-3" /> Sistema
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Configuración</h1>
      </header>

      <div className="flex items-center gap-2 border-b border-white/5">
        <TabButton id="models" label="Modelos IA" icon={Cpu} />
        <TabButton id="apis" label="APIs" icon={Globe} />
        <TabButton id="params" label="Parametrización" icon={Activity} />
        <TabButton id="audit" label="Auditoría" icon={Terminal} />
      </div>

      {tab === "models" && (
        <div className="space-y-6">
          <form onSubmit={saveModel} className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase flex items-center gap-2">
              {editingId ? <RefreshCw className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {editingId ? "Editar modelo" : "Nuevo modelo"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required placeholder="Nombre" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as any })} className="bg-white/5 border border-white/10 p-2 text-xs">
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input placeholder="País" value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
              <input placeholder="Base URL" value={form.baseUrl || ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-3" />
              <div className="flex gap-2 md:col-span-3">
                <input required placeholder="Model path (ej: qwen2.5)" value={form.modelPath || ""} onChange={(e) => setForm({ ...form, modelPath: e.target.value })} className="flex-1 bg-white/5 border border-white/10 p-2 text-xs" />
                {form.provider === "ollama" && (
                  <button type="button" onClick={discoverModels} disabled={discovering} className="px-3 py-2 border border-neonCyan/30 text-neonCyan text-[9px] font-black uppercase tracking-widest hover:bg-neonCyan/10 disabled:opacity-30">
                    {discovering ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />} Descubrir
                  </button>
                )}
              </div>
              {discovered.length > 0 && (
                <select
                  value={form.modelPath || ""}
                  onChange={(e) => setForm({ ...form, modelPath: e.target.value })}
                  className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-3"
                >
                  <option value="">Seleccionar modelo local</option>
                  {discovered.map((m) => (
                    <option key={m.name} value={m.model}>{m.name} {m.parameter_size && `(${m.parameter_size})`}</option>
                  ))}
                </select>
              )}
              {form.provider === "openai" && (
                <input type="password" required placeholder="API Key de OpenAI" value={form.apiKey || ""} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-2" />
              )}
              {form.provider !== "openai" && (
                <input type="password" placeholder="API Key (opcional)" value={form.apiKey || ""} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs md:col-span-2" />
              )}
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#666]">
                <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo por defecto
              </label>
            </div>
            <textarea
              value={form.config || "{}"}
              onChange={(e) => setForm({ ...form, config: e.target.value })}
              rows={6}
              className="w-full bg-white/5 border border-white/10 p-3 text-xs font-geist-mono"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-neonCyan text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-30">
                <Save className="w-3 h-3" /> {editingId ? "Actualizar" : "Guardar"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-4 py-2 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:border-neonCyan">
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.id} className="glass-panel p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${m.active ? "bg-neonCyan shadow-[0_0_8px_#00F0FF]" : "bg-white/10"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{m.name}</span>
                      <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{m.provider}</span>
                      {m.active && <span className="text-[9px] text-neonCyan uppercase">Activo</span>}
                    </div>
                    <div className="text-[9px] text-[#666] uppercase tracking-wider mt-0.5">
                      {m.modelPath} · {m.baseUrl || "default"} {m.country && ` · ${m.country}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => testModel(m.id)} disabled={testingId === m.id} className="flex items-center gap-1 px-3 py-1.5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:border-neonCyan disabled:opacity-30">
                    {testingId === m.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Test
                  </button>
                  <button onClick={() => editModel(m)} className="p-1.5 border border-white/10 hover:border-neonCyan text-[#666] hover:text-neonCyan">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteModel(m.id)} className="p-1.5 border border-white/10 hover:border-red-500 text-[#666] hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {models.length === 0 && <p className="text-[10px] text-[#444] uppercase tracking-widest text-center py-8">Sin modelos configurados</p>}
          </div>
        </div>
      )}

      {tab === "apis" && (
        <div className="glass-panel p-12 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
          Módulo APIs en construcción.
        </div>
      )}

      {tab === "params" && (
        <div className="glass-panel p-12 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
          Parametrización global en construcción.
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase flex items-center gap-2"><Terminal className="w-3 h-3" /> Eventos recientes</h3>
            <button onClick={loadAudit} className="text-[9px] font-black uppercase tracking-widest text-neonCyan hover:text-white">Recargar</button>
          </div>
          {logs.map((l) => (
            <div key={l.id} className="glass-panel p-3 flex items-start gap-3 text-[10px]">
              {l.status === "success" ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" /> : l.status === "error" ? <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-3 h-3 text-neonCyan shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <span className="font-bold text-white/70">{l.action}</span>
                  <span className="text-[#444]">{new Date(l.createdAt).toLocaleString()}</span>
                  {l.latencyMs && <span className="text-[#444] flex items-center gap-1"><Clock className="w-3 h-3" /> {l.latencyMs}ms</span>}
                </div>
                <p className="text-[#888] mt-0.5 truncate">{l.message}</p>
                {l.aiModel && <p className="text-[#444] mt-0.5">{l.aiModel.name} · {l.aiModel.provider}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
