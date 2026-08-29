"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Cpu, AlertCircle, ArrowRight } from "lucide-react";
import { mensajeDeError } from "@/lib/mensajeError";

interface AiModel {
  id: string;
  name: string;
  provider: string;
  active: boolean;
}

interface ModuleSetting {
  id: string;
  module: string;
  settingKey: string;
  aiModelId: string;
  aiModel: AiModel;
  updatedAt: string;
}

interface Toast {
  type: "success" | "error" | "info";
  message: string;
}

export default function ParametrizacionTab({
  models,
  toast,
}: {
  models: AiModel[];
  toast: (type: Toast["type"], message: string) => void;
}) {
  const [settings, setSettings] = useState<ModuleSetting[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const ollamaModels = models.filter((m) => m.provider === "ollama");

  // Estable mientras lo sea `toast`, que el padre memoriza. Así el efecto puede
  // declarar su dependencia real sin cambiar cuándo se ejecuta.
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/config/module-settings");
      const data = await res.json();
      setSettings(data.settings || []);
    } catch (err: unknown) {
      toast("error", "Error cargando configuraciones: " + mensajeDeError(err));
    }
  }, [toast]);

  useEffect(() => {
    // Las cargas van dentro de una función asíncrona propia: así el efecto no
    // ejecuta setState de forma síncrona (§6.2). Mismo momento, mismo resultado.
    void (async () => {
      await loadSettings();
    })();
  }, [loadSettings]);

  const getSelectedModel = (settingKey: string) => {
    const setting = settings.find(
      (s) => s.module === "base_oficial" && s.settingKey === settingKey
    );
    return setting?.aiModelId || "";
  };

  const saveSetting = async (settingKey: string, aiModelId: string) => {
    if (!aiModelId) {
      toast("error", "Selecciona un modelo");
      return;
    }
    setSaving(settingKey);
    try {
      const res = await fetch("/api/config/module-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "base_oficial",
          settingKey,
          aiModelId,
        }),
      });
      if (!res.ok) throw new Error("Error guardando");
      await loadSettings();
      toast("success", "Configuración guardada");
    } catch (err: unknown) {
      toast("error", mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  if (ollamaModels.length === 0) {
    return (
      <div className="glass-panel p-8 space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-xs font-bold uppercase">No hay modelos Ollama configurados</h3>
        </div>
        <p className="text-[10px] text-[#666] leading-relaxed">
          Para configurar los modelos de Base Oficial, primero debes agregar al menos un modelo Ollama
          en la pestaña <strong>Modelos IA</strong>.
        </p>
        <a
          href="/configuracion"
          className="inline-flex items-center gap-2 px-4 py-2 bg-neonCyan text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-colors"
        >
          Ir a Modelos IA <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 space-y-2">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2">
          <Cpu className="w-3 h-3" /> Configuración de Modelos para Base Oficial
        </h3>
        <p className="text-[10px] text-[#666] uppercase tracking-widest">
          Selecciona qué modelos de Ollama usar para embeddings y generación de respuestas
        </p>
      </div>

      <div className="glass-panel p-6 space-y-4">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-neonCyan">
            Modelo de Embeddings (Base Oficial)
          </h4>
          <p className="text-[9px] text-[#666] mt-1">
            Genera vectores para búsqueda semántica (recomendado: nomic-embed-text)
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={getSelectedModel("embedding_model")}
            onChange={(e) => saveSetting("embedding_model", e.target.value)}
            disabled={saving === "embedding_model"}
            className="flex-1 bg-white/5 border border-white/10 p-3 text-xs"
          >
            <option value="">Seleccionar modelo...</option>
            {ollamaModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.active ? "(activo)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => saveSetting("embedding_model", getSelectedModel("embedding_model"))}
            disabled={saving === "embedding_model" || !getSelectedModel("embedding_model")}
            className="px-4 py-2 bg-neonCyan text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-30 flex items-center gap-2"
          >
            {saving === "embedding_model" ? "Guardando..." : <><Save className="w-3 h-3" /> Guardar</>}
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-4">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-neonCyan">
            Modelo de Generación/Análisis (Base Oficial)
          </h4>
          <p className="text-[9px] text-[#666] mt-1">
            Genera respuestas y análisis sobre documentos (recomendado: qwen2.5:32b)
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={getSelectedModel("generation_model")}
            onChange={(e) => saveSetting("generation_model", e.target.value)}
            disabled={saving === "generation_model"}
            className="flex-1 bg-white/5 border border-white/10 p-3 text-xs"
          >
            <option value="">Seleccionar modelo...</option>
            {ollamaModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.active ? "(activo)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => saveSetting("generation_model", getSelectedModel("generation_model"))}
            disabled={saving === "generation_model" || !getSelectedModel("generation_model")}
            className="px-4 py-2 bg-neonCyan text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-30 flex items-center gap-2"
          >
            {saving === "generation_model" ? "Guardando..." : <><Save className="w-3 h-3" /> Guardar</>}
          </button>
        </div>
      </div>

      {settings.filter(s => s.module === "base_oficial").length > 0 && (
        <div className="glass-panel p-6 space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
            Configuraciones guardadas
          </h4>
          <div className="space-y-2">
            {settings
              .filter((s) => s.module === "base_oficial")
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-white/70">
                      {s.settingKey === "embedding_model" ? "Embeddings" : "Generación"}
                    </span>
                    <p className="text-[9px] text-[#666]">
                      Actualizado: {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-[10px] text-neonCyan">
                    {s.aiModel.name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
