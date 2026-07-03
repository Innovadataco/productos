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
  scope: "local" | "cloud";
  baseUrl: string | null;
  apiKey: string | null;
  modelPath: string;
  active: boolean;
  config: string;
  createdAt: string;
}

interface AgentApi {
  id: string;
  key: string;
  name: string;
  description: string;
  module: string;
  submodule: string;
  category: "internal" | "external";
  method: string;
  path: string;
  authType: string;
  active: boolean;
  config: string;
  createdAt: string;
  updatedAt: string;
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

interface TestResult {
  modelId: string;
  requestedAt: string;
  completedAt: string;
  ok: boolean;
  latencyMs: number;
  text: string;
  rawText?: string;
  error?: string;
}

interface DiscoveredModel {
  name: string;
  model: string;
  parameter_size?: string;
}

const PROVIDERS = [
  { value: "ollama", label: "Ollama" },
  { value: "openai", label: "OpenAI" },
  { value: "mock", label: "Mock (pruebas)" },
];

const SCOPES = [
  { value: "local", label: "Local" },
  { value: "cloud", label: "Cloud" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const DEFAULT_CONFIG = {
  temperature: 0.2,
  top_p: 0.9,
  max_tokens: 1024,
  systemPrompt: "Eres un asistente experto en documentos legales colombianos. Responde ÚNICAMENTE con JSON válido.",
};

const emptyForm = (): Partial<AiModel> => ({
  provider: "ollama",
  scope: "local",
  baseUrl: "http://localhost:11434",
  modelPath: "",
  active: true,
  config: JSON.stringify(DEFAULT_CONFIG, null, 2),
});

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] uppercase tracking-widest text-[#666] font-bold">{label}</span>
      {children}
    </label>
  );
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<"models" | "apis" | "params" | "audit">("models");
  const [models, setModels] = useState<AiModel[]>([]);
  const [apis, setApis] = useState<AgentApi[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AiModel>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredModel[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const toast = (type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const loadModels = async () => {
    const res = await fetch("/api/config/models");
    setModels(await res.json());
  };

  const loadApis = async () => {
    const res = await fetch("/api/config/apis");
    setApis(await res.json());
  };

  const loadAudit = async () => {
    const res = await fetch("/api/config/audit?limit=100");
    setLogs(await res.json());
  };

  useEffect(() => {
    loadModels();
    loadApis();
    loadAudit();
  }, []);

  const saveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modelPath) {
      toast("error", "Selecciona un modelo");
      return;
    }
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
      setDiscovered([]);
      setTestResult(null);
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
    const requestedAt = new Date().toISOString();
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch("/api/config/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      const completedAt = new Date().toISOString();
      setTestResult({ modelId: id, requestedAt, completedAt, ...data });
      if (data.ok) toast("success", `Conexión OK ${data.latencyMs}ms`);
      else toast("error", `Fallo: ${data.error}`);
      await loadAudit();
    } catch (err: any) {
      setTestResult({ modelId: id, requestedAt, completedAt: new Date().toISOString(), ok: false, latencyMs: 0, text: "", error: err.message });
      toast("error", err.message);
    } finally {
      setTestingId(null);
    }
  };

  const toggleApi = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/config/apis/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Error toggling API");
      await loadApis();
      toast("success", active ? "API activada" : "API inhabilitada");
    } catch (err: any) {
      toast("error", err.message);
    }
  };

  const deleteModel = async (id: string) => {
    if (!confirm("Eliminar modelo?")) return;
    try {
      const res = await fetch(`/api/config/models/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando");
      if (testResult?.modelId === id) setTestResult(null);
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
    setDiscovered([]);
    setTestResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDiscovered([]);
    setTestResult(null);
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

  const modelSelector = () => {
    if (form.provider === "mock") {
      return (
        <Field label="Modelo de prueba" className="md:col-span-2">
          <select value={form.modelPath || "mock"} onChange={(e) => setForm({ ...form, modelPath: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs">
            <option value="mock">mock</option>
          </select>
        </Field>
      );
    }
    if (form.provider === "openai") {
      return (
        <Field label="Modelo OpenAI" className="md:col-span-2">
          <select value={form.modelPath || ""} onChange={(e) => setForm({ ...form, modelPath: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs">
            <option value="">Seleccionar modelo</option>
            {OPENAI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      );
    }
    return (
      <Field label="Modelo local" className="md:col-span-2">
        <div className="flex gap-2">
          <select value={form.modelPath || ""} onChange={(e) => setForm({ ...form, modelPath: e.target.value })} className="flex-1 bg-white/5 border border-white/10 p-2 text-xs">
            <option value="">{discovered.length ? "Seleccionar modelo local" : "Descubre modelos primero"}</option>
            {discovered.map((m) => (
              <option key={m.name} value={m.model}>{m.name} {m.parameter_size && `(${m.parameter_size})`}</option>
            ))}
          </select>
          <button type="button" onClick={discoverModels} disabled={discovering} className="px-3 py-2 border border-neonCyan/30 text-neonCyan text-[9px] font-black uppercase tracking-widest hover:bg-neonCyan/10 disabled:opacity-30">
            {discovering ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />} Descubrir
          </button>
        </div>
      </Field>
    );
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nombre del modelo" className="md:col-span-2">
                <input required placeholder="Ej: Qwen Coder Local" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
              </Field>

              <Field label="Proveedor">
                <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as any, modelPath: "" })} className="bg-white/5 border border-white/10 p-2 text-xs">
                  {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>

              <Field label="Ámbito de despliegue">
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })} className="bg-white/5 border border-white/10 p-2 text-xs">
                  {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="URL del servicio" className="md:col-span-2">
                <input placeholder="Ej: http://localhost:11434 para Ollama" value={form.baseUrl || ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
              </Field>

              {modelSelector()}

              <Field label={form.provider === "openai" ? "API Key (requerida)" : "API Key (opcional)"} className="md:col-span-2">
                <input type="password" required={form.provider === "openai"} placeholder={form.provider === "openai" ? "sk-..." : "Dejar vacío si no aplica"} value={form.apiKey || ""} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="bg-white/5 border border-white/10 p-2 text-xs" />
              </Field>

              <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#666] md:col-span-2">
                <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo por defecto
              </label>

              <Field label="Configuración JSON (temperature, top_p, max_tokens, systemPrompt)" className="md:col-span-2">
                <textarea
                  value={form.config || "{}"}
                  onChange={(e) => setForm({ ...form, config: e.target.value })}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 p-3 text-xs font-geist-mono"
                />
              </Field>
            </div>
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

          {testResult && (
            <div className={`glass-panel p-4 space-y-2 border-l-2 ${testResult.ok ? "border-l-green-500" : "border-l-red-500"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase flex items-center gap-2">
                  {testResult.ok ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                  Resultado del test de conexión
                </h3>
                <button onClick={() => setTestResult(null)} className="text-white/30 hover:text-white"><X className="w-3 h-3" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                <div className="text-[#666]">Solicitud: <span className="text-white/70">{new Date(testResult.requestedAt).toLocaleString()}</span></div>
                <div className="text-[#666]">Resultado: <span className="text-white/70">{new Date(testResult.completedAt).toLocaleString()}</span></div>
                <div className="text-[#666]">Latencia: <span className="text-white/70">{testResult.latencyMs}ms</span></div>
              </div>
              {testResult.error ? (
                <div className="text-[10px] text-red-400 bg-red-400/5 p-2 rounded">{testResult.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-[#666]">Respuesta cruda del modelo</div>
                  <pre className="text-[10px] text-[#888] bg-black/30 p-2 rounded overflow-auto max-h-40 font-geist-mono">{testResult.rawText || testResult.text || "(sin texto)"}</pre>
                  <div className="text-[9px] uppercase tracking-widest text-[#666]">Respuesta procesada</div>
                  <pre className="text-[10px] text-[#888] bg-black/30 p-2 rounded overflow-auto max-h-40 font-geist-mono">{testResult.text || "(sin texto)"}</pre>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.id} className="glass-panel p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${m.active ? "bg-neonCyan shadow-[0_0_8px_#00F0FF]" : "bg-white/10"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{m.name}</span>
                      <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{m.provider}</span>
                      <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{m.scope}</span>
                      {m.active && <span className="text-[9px] text-neonCyan uppercase">Activo</span>}
                    </div>
                    <div className="text-[9px] text-[#666] uppercase tracking-wider mt-0.5">
                      {m.modelPath} · {m.baseUrl || "default"}
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
        <div className="space-y-8">
          <div className="glass-panel p-6 space-y-2">
            <h3 className="text-xs font-bold uppercase flex items-center gap-2"><Globe className="w-3 h-3" /> Catálogo de APIs del agente</h3>
            <p className="text-[10px] text-[#666] uppercase tracking-widest">Activa o inhabilita las APIs que el bot de Telegram podrá consumir.</p>
          </div>
          {Object.entries(
            apis.reduce((acc, api) => {
              if (!acc[api.module]) acc[api.module] = {};
              if (!acc[api.module][api.submodule]) acc[api.module][api.submodule] = [];
              acc[api.module][api.submodule].push(api);
              return acc;
            }, {} as Record<string, Record<string, AgentApi[]>>)
          ).map(([module, submodules]) => (
            <div key={module} className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neonCyan">{module.replace(/_/g, " ")}</h4>
              {Object.entries(submodules).map(([submodule, items]) => (
                <div key={submodule} className="space-y-2">
                  <h5 className="text-[9px] font-bold uppercase tracking-widest text-[#666]">{submodule.replace(/_/g, " ")}</h5>
                  {items.map((api) => (
                    <div key={api.id} className="glass-panel p-4 flex items-center justify-between hover:bg-white/[0.02]">
                      <div className="flex items-start gap-4">
                        <div className={`h-2 w-2 rounded-full mt-1.5 ${api.active ? "bg-neonCyan shadow-[0_0_8px_#00F0FF]" : "bg-white/10"}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase">{api.name}</span>
                            <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{api.method}</span>
                            <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{api.category}</span>
                            {api.authType !== "none" && <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 uppercase">{api.authType}</span>}
                          </div>
                          <p className="text-[10px] text-[#666] mt-0.5">{api.description}</p>
                          <code className="text-[9px] text-[#444] font-geist-mono">{api.path}</code>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[9px] uppercase tracking-widest text-[#666]">{api.active ? "Activo" : "Inactivo"}</span>
                        <input
                          type="checkbox"
                          checked={api.active}
                          onChange={(e) => toggleApi(api.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-white/10 rounded-full peer-checked:bg-neonCyan relative transition-colors">
                          <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {apis.length === 0 && <p className="text-[10px] text-[#444] uppercase tracking-widest text-center py-8">Sin APIs registradas</p>}
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
