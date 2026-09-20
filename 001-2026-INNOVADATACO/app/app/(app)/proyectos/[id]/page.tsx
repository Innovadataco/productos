"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DocumentosSection from "../../../components/DocumentosSection";

interface Proyecto {
  id: string;
  codigo: string;
  nombre: string;
  alcance: string | null;
  estado: string;
  progreso: number;
  fechaInicioReal: string | null;
  fechaEntregaPlaneada: string | null;
  valorContratado: number | null;
  cliente: { nombre: string } | null;
  responsable: { nombre: string } | null;
  hitos: { id: string; nombre: string; estado: string; fechaInicio: string | null; fechaFin: string | null }[];
}

export default function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`/api/proyectos/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProyecto(data);
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, [id]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyecto) return;
    await fetch(`/api/proyectos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: proyecto.nombre,
        estado: proyecto.estado,
        alcance: proyecto.alcance,
      }),
    });
    router.refresh();
  };

  if (cargando) return <div className="page-enter text-white/50">Cargando proyecto...</div>;
  if (!proyecto) return <div className="page-enter text-white/50">Proyecto no encontrado</div>;

  const statusClass = (estado: string) => {
    switch (estado) {
      case "ACTIVO": return "status-activo";
      case "PLANIFICACION": return "status-planificacion";
      case "CERRADO":
      case "CANCELADO": return "status-cerrado";
      default: return "status-planificacion";
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portafolio" className="btn-secondary"><i className="fas fa-arrow-left"></i></Link>
        <div>
          <h2 className="text-2xl font-bold">{proyecto.nombre}</h2>
          <p className="text-white/50 text-sm">{proyecto.codigo}</p>
        </div>
        <span className={`status-badge ${statusClass(proyecto.estado)}`}>{proyecto.estado}</span>
      </div>

      <form onSubmit={guardar} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Información general</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-white/60 mb-2">NOMBRE</label>
                <input className="input-field" value={proyecto.nombre} onChange={(e) => setProyecto({ ...proyecto, nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">ESTADO</label>
                <select className="input-field" value={proyecto.estado} onChange={(e) => setProyecto({ ...proyecto, estado: e.target.value })}>
                  <option value="PLANIFICACION">Planificación</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="EN_PAUSA">En pausa</option>
                  <option value="ENTREGADO">Entregado</option>
                  <option value="CERRADO">Cerrado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">PROGRESO (%)</label>
                <input type="number" className="input-field" value={proyecto.progreso} onChange={(e) => setProyecto({ ...proyecto, progreso: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-white/60 mb-2">ALCANCE</label>
                <textarea className="input-field" rows={3} value={proyecto.alcance || ""} onChange={(e) => setProyecto({ ...proyecto, alcance: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Hitos</h3>
            {proyecto.hitos.length === 0 && <p className="text-white/50 text-sm">No hay hitos registrados.</p>}
            {proyecto.hitos.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${h.estado === "COMPLETADO" ? "bg-green-500/20 text-green-400" : h.estado === "EN_CURSO" ? "bg-[var(--data)]/20 text-[var(--data-light)]" : "bg-white/10 text-white/50"}`}>
                  <i className={`fas ${h.estado === "COMPLETADO" ? "fa-check" : h.estado === "EN_CURSO" ? "fa-spinner" : "fa-lock"}`}></i>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{h.nombre}</div>
                  <div className="text-xs text-white/40">{h.fechaInicio ? new Date(h.fechaInicio).toLocaleDateString("es-CO") : "-"} → {h.fechaFin ? new Date(h.fechaFin).toLocaleDateString("es-CO") : "-"}</div>
                </div>
                <span className="status-badge status-planificacion">{h.estado}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Resumen</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Cliente</span><span>{proyecto.cliente?.nombre || "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Responsable</span><span>{proyecto.responsable?.nombre || "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Valor</span><span>{proyecto.valorContratado ? `$${(proyecto.valorContratado / 1_000_000).toFixed(0)}M` : "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Inicio</span><span>{proyecto.fechaInicioReal ? new Date(proyecto.fechaInicioReal).toLocaleDateString("es-CO") : "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Entrega</span><span>{proyecto.fechaEntregaPlaneada ? new Date(proyecto.fechaEntregaPlaneada).toLocaleDateString("es-CO") : "-"}</span></div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Acciones</h3>
            <button type="submit" className="btn-primary w-full">Guardar cambios</button>
          </div>
        </div>
      </form>

      <DocumentosSection relacion="proyecto" entidadId={id} />
    </div>
  );
}
