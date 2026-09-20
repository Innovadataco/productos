"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Proyecto {
  id: string;
  codigo: string;
  nombre: string;
  alcance: string | null;
  estado: string;
  progreso: number;
  cliente: { nombre: string } | null;
  hitos: { id: string }[];
}

export default function PortafolioPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proyectos")
      .then((res) => res.json())
      .then((data) => {
        setProyectos(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch(() => {
        setError("No se pudieron cargar los proyectos");
        setCargando(false);
      });
  }, []);

  const statusClass = (estado: string) => {
    switch (estado) {
      case "ACTIVO": return "status-activo";
      case "PLANIFICACION": return "status-planificacion";
      case "CERRADO":
      case "CANCELADO": return "status-cerrado";
      default: return "status-planificacion";
    }
  };

  if (cargando) return <div className="page-enter text-white/50">Cargando proyectos...</div>;
  if (error) return <div className="page-enter text-red-400">{error}</div>;

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">Portafolio</h2>
          <p className="text-white/50">Gestión de proyectos y clientes</p>
        </div>
        <Link href="/proyectos/nuevo" className="btn-gold">
          <i className="fas fa-plus mr-2"></i>Nuevo proyecto
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {proyectos.map((proyecto) => (
          <Link
            key={proyecto.id}
            href={`/proyectos/${proyecto.id}`}
            className="glass-card p-5 block no-underline text-white"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--data)] to-[var(--navy-mid)] flex items-center justify-center text-xl">
                <i className="fas fa-briefcase text-white"></i>
              </div>
              <span className={`status-badge ${statusClass(proyecto.estado)}`}>{proyecto.estado}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{proyecto.nombre}</h3>
            <p className="text-white/50 text-sm mb-4 line-clamp-2">{proyecto.alcance || "Sin descripción"}</p>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Progreso</span>
              <span className="text-[var(--data-light)]">{proyecto.progreso}%</span>
            </div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${proyecto.progreso}%` }}></div>
            </div>
            <div className="flex items-center justify-between text-xs text-white/40">
              <span><i className="fas fa-user mr-1"></i>{proyecto.cliente?.nombre || "Sin cliente"}</span>
              <span><i className="fas fa-clock mr-1"></i>{proyecto.hitos.length} hitos</span>
            </div>
          </Link>
        ))}
      </div>

      {proyectos.length === 0 && (
        <div className="glass-card p-10 text-center mt-8">
          <p className="text-white/50">No hay proyectos aún. Crea uno nuevo o convierte una oportunidad.</p>
        </div>
      )}
    </div>
  );
}
