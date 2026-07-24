"use client";

import { LayoutGrid, Plus, Search, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import ProjectForm, { type ProyectoEditable } from "@/components/ProjectForm";
import { nombreDeFase } from "@/lib/fasesPm2";

type Proyecto = ProyectoEditable;

/**
 * Listado de proyectos (spec 008, US1).
 *
 * I-011 y su criterio general —ningún elemento debe señalar interactividad que
 * no tiene— se aplican aquí a los cuatro casos que había: la flecha y la tarjeta
 * abren la edición, el buscador filtra de verdad y el botón de filtro sin
 * semántica se retiró en vez de fingirla.
 */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Proyecto[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Proyecto | undefined>(undefined);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      // El listado exige sesión (spec 004, FR-012): ante 401 la respuesta es un
      // objeto de error, no un arreglo. Sin esta guarda, el .map() de más abajo
      // rompería la página en lugar de mostrarla vacía.
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchProjects();
    })();
  }, []);

  const abrirNuevo = () => {
    setEditando(undefined);
    setIsModalOpen(true);
  };

  const abrirEdicion = (proyecto: Proyecto) => {
    setEditando(proyecto);
    setIsModalOpen(true);
  };

  const termino = busqueda.trim().toLowerCase();
  const filtrados = termino
    ? projects.filter((p) =>
        [p.codigo, p.nombre, p.cliente].some((campo) => campo?.toLowerCase().includes(termino)),
      )
    : projects;

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
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neonCyan transition-all self-start"
        >
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </header>

      {isModalOpen && (
        <ProjectForm
          proyecto={editando}
          onClose={() => setIsModalOpen(false)}
          onRefresh={fetchProjects}
        />
      )}

      {/* El buscador filtra de verdad (I-011, caso 3). El botón de filtro que no
          hacía nada se retiró: fingir una semántica que no existe sería repetir
          la incidencia (I-011, caso 4). */}
      <div className="flex items-center gap-4 py-4 border-y border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre o cliente..."
            className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-4 text-xs font-geist-mono focus:outline-none focus:border-neonCyan transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="h-20 w-full glass-panel animate-pulse bg-white/5" />
        ) : filtrados.length === 0 ? (
          <div className="glass-panel p-12 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
            {projects.length === 0
              ? "No hay proyectos registrados en Innovadataco."
              : "Ningún proyecto coincide con la búsqueda."}
          </div>
        ) : (
          filtrados.map((p) => (
            /* La tarjeta entera abre la edición: ya tenía cursor-pointer y hover
               sin hacer nada (I-011, caso 2). */
            <div
              key={p.id}
              onClick={() => abrirEdicion(p)}
              className="glass-panel group p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
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
                    {nombreDeFase(p.currentPhase)}
                  </div>
                </div>
                {/* I-011, caso 1: la flecha pintaba hover sin hacer nada. Ahora
                    es un botón real que abre el proyecto. */}
                <button
                  type="button"
                  aria-label={`Editar proyecto ${p.nombre}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(p);
                  }}
                  className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center hover:border-neonCyan transition-colors"
                >
                  <ArrowRight className="w-4 h-4 text-[#444] group-hover:text-neonCyan transition-colors" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
