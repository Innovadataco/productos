"use client";

import { LayoutGrid, Plus, Search, Filter, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import ProjectForm from "@/components/ProjectForm";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos`);
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
            Gestión Operativa PM²
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Dashboard de Proyectos</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neonCyan transition-all self-start"
        >
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </header>

      {isModalOpen && (
        <ProjectForm 
          onClose={() => setIsModalOpen(false)} 
          onRefresh={fetchProjects}
        />
      )}

      <div className="flex items-center gap-4 py-4 border-y border-white/5">
        <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
           <input 
              type="text" 
              placeholder="Buscar en la Base de Datos Real..." 
              className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-4 text-xs font-geist-mono focus:outline-none focus:border-neonCyan transition-colors"
           />
        </div>
        <button className="p-2 border border-white/10 hover:border-neonCyan transition-colors">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="h-20 w-full glass-panel animate-pulse bg-white/5" />
        ) : projects.length === 0 ? (
          <div className="glass-panel p-12 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
            No hay proyectos registrados en Innovadataco.
          </div>
        ) : (
          projects.map((p: any) => (
            <div key={p.id} className="glass-panel group p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-6">
                <div className="h-10 w-10 rounded bg-white/5 flex items-center justify-center text-neonCyan group-hover:bg-neonCyan/20 transition-colors">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-geist-mono text-[#666] tracking-tighter uppercase">{p.codigo}</span>
                  <h3 className="font-bold tracking-tight text-sm uppercase">{p.nombre}</h3>
                  <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">{p.cliente}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-12">
                 <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-[8px] text-[#444] uppercase font-black">Fase PM²</span>
                    <div className="px-2 py-0.5 rounded-full bg-neonCyan/10 text-neonCyan text-[9px] font-bold uppercase tracking-tighter">
                      {p.current_phase}
                    </div>
                 </div>
                 <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center hover:border-neonCyan transition-colors">
                    <ArrowRight className="w-4 h-4 text-[#444] group-hover:text-neonCyan transition-colors" />
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
