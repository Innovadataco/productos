"use client";

import { useState } from "react";
import { X, Send, ShieldCheck, Database, Calendar } from "lucide-react";

export default function ProjectForm({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    cliente: "",
    current_phase: "initiation",
    budget: "0"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Registro en tabla Proyectos
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({
          codigo: formData.codigo,
          nombre: formData.nombre,
          cliente: formData.cliente,
          current_phase: formData.current_phase
        })
      });

      if (!res.ok) throw new Error("Error registrando proyecto");
      const project = await res.json();

      // 2. Registro Inicial Financiero
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pm2_financials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: project[0].id,
          budget: parseFloat(formData.budget)
        })
      });

      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fallo en Innovadataco: No se pudo registrar el proyecto en BD real.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-lg p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onClose} className="text-[#444] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <header className="space-y-1">
          <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
            <ShieldCheck className="w-3 h-3" /> Protocolo de Registro PM²
          </div>
          <h2 className="text-xl font-bold tracking-tight">Nueva Iniciativa</h2>
        </header>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">Fase Inicial</label>
              <select 
                className="w-full bg-white/5 border border-white/10 p-3 text-xs focus:border-neonCyan outline-none appearance-none cursor-pointer"
                value={formData.current_phase}
                onChange={(e) => setFormData({...formData, current_phase: e.target.value})}
              >
                <option value="initiation">Inicio (Initiation)</option>
                <option value="planning">Planificación</option>
                <option value="execution">Ejecución</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase tracking-widest pl-1">Presupuesto (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neonCyan text-[10px]">$</span>
                <input 
                  type="number"
                  className="w-full bg-white/5 border border-white/10 p-3 pl-6 text-xs focus:border-neonCyan outline-none transition-all"
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-neonCyan text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Sincronizando..." : <><Send className="w-3 h-3" /> Registrar en Base de Datos</>}
          </button>
        </form>
        
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-[#444] font-bold uppercase tracking-widest">
           <div className="flex items-center gap-1"><Database className="w-3 h-3" /> Local Storage Active</div>
           <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Sync Jul 2026</div>
        </div>
      </div>
    </div>
  );
}
