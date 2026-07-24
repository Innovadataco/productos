"use client";

import { useState } from "react";
import { X, Send, ShieldCheck, Database, Calendar } from "lucide-react";
import { FASES_PM2 } from "@/lib/fasesPm2";
import GestionPm2 from "@/components/proyectos/GestionPm2";

/**
 * Formulario de proyecto: crea Y edita (spec 008, FR-004).
 *
 * El modo lo decide la presencia de `proyecto`: sin él es alta (`POST`), con él
 * es edición (`PATCH /api/projects/[id]`). Un solo formulario para los dos
 * casos, como pide FR-004 ("reutilizando el formulario de creación donde tenga
 * sentido").
 */

export interface ProyectoEditable {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  estado: string;
  currentPhase: string;
}

interface ProjectFormProps {
  onClose: () => void;
  onRefresh: () => void;
  /** Presente = edición; ausente = alta. */
  proyecto?: ProyectoEditable;
}

export default function ProjectForm({ onClose, onRefresh, proyecto }: ProjectFormProps) {
  const editando = proyecto !== undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo: proyecto?.codigo ?? "",
    nombre: proyecto?.nombre ?? "",
    cliente: proyecto?.cliente ?? "",
    currentPhase: proyecto?.currentPhase ?? "initiation",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(editando ? `/api/projects/${proyecto.id}` : "/api/projects", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: formData.codigo,
          nombre: formData.nombre,
          cliente: formData.cliente,
          currentPhase: formData.currentPhase,
        }),
      });

      if (!res.ok) {
        // El servidor ya devuelve un mensaje legible por contrato (apiError):
        // se muestra ese, nunca el detalle técnico de una excepción (§0.3).
        const cuerpo = await res.json().catch(() => ({}));
        setError(
          typeof cuerpo?.error === "string"
            ? cuerpo.error
            : editando
              ? "No se pudo guardar el proyecto."
              : "No se pudo registrar el proyecto.",
        );
        return;
      }

      onRefresh();
      onClose();
    } catch (err: unknown) {
      console.error("[Proyectos] Guardar proyecto: error — la petición falló", err);
      setError("No se pudo contactar con el servidor. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-lg p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onClose} className="text-[#444] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <header className="space-y-1">
          <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
            <ShieldCheck className="w-3 h-3" /> Protocolo de Registro PM²
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {editando ? "Editar Proyecto" : "Nueva Iniciativa"}
          </h2>
        </header>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-geist-mono">
          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">Código Oficial</label>
            <input
              required
              placeholder="00X-2026-CLIENTE-SISTEMA"
              className="w-full bg-white/5 border border-white/10 p-3 text-xs focus:border-neonCyan outline-none transition-all"
              value={formData.codigo}
              onChange={(e) => setFormData({...formData, codigo: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">Nombre</label>
              <input
                required
                className="w-full bg-white/5 border border-white/10 p-3 text-xs focus:border-neonCyan outline-none transition-all"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">Cliente</label>
              <input
                required
                className="w-full bg-white/5 border border-white/10 p-3 text-xs focus:border-neonCyan outline-none transition-all"
                value={formData.cliente}
                onChange={(e) => setFormData({...formData, cliente: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">
              {editando ? "Fase PM²" : "Fase Inicial"}
            </label>
            {/* Las 4 fases salen de FASES_PM2: antes estaban cableadas y faltaba Cierre. */}
            <select
              className="w-full bg-white/5 border border-white/10 p-3 text-xs focus:border-neonCyan outline-none appearance-none cursor-pointer"
              value={formData.currentPhase}
              onChange={(e) => setFormData({...formData, currentPhase: e.target.value})}
            >
              {FASES_PM2.map((fase) => (
                <option key={fase.key} value={fase.key}>{fase.nombre}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Sincronizando..." : <><Send className="w-3 h-3" /> {editando ? "Guardar cambios" : "Registrar en Base de Datos"}</>}
          </button>
        </form>

        {/* La gestión PM2 solo tiene sentido sobre un proyecto que ya existe
            (spec 008, US3–US6): en el alta todavía no hay id al que colgar nada. */}
        {editando && <GestionPm2 proyectoId={proyecto.id} />}

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-[#444] font-bold uppercase tracking-widest">
           {/* El rótulo decía "Local Storage Active": los proyectos viven en
               PostgreSQL. Un pie que miente sobre dónde están los datos es del
               mismo género que I-011. */}
           <div className="flex items-center gap-1"><Database className="w-3 h-3" /> PostgreSQL IDC</div>
           <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> PM² 2026</div>
        </div>
      </div>
    </div>
  );
}
