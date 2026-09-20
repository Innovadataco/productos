"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCOP, diasEjecucion, formatDateDisplay } from "../../lib/format";

interface Oportunidad {
  id: string;
  codigo: string;
  nombre: string;
  entidadContratante: string;
  estado: string;
  valorEstimado: number | null;
  fechaInicioPlaneada: string | null;
  fechaFinPlaneada: string | null;
  responsable: { nombre: string } | null;
}

export default function OportunidadesPage() {
  const router = useRouter();
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/oportunidades")
      .then((res) => res.json())
      .then((data) => {
        setOportunidades(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, []);

  const finalizar = async (id: string) => {
    if (!confirm("¿Finalizar esta oportunidad?")) return;
    await fetch(`/api/oportunidades/${id}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoCierre: "Finalizada por el usuario" }),
    });
    setOportunidades((prev) =>
      prev.map((o) => (o.id === id ? { ...o, estado: "CERRADA" } : o))
    );
  };

  if (cargando) return <div className="page-enter text-white/50">Cargando oportunidades...</div>;

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Oportunidades</h2>
          <p className="text-white/50 text-sm md:text-base">Pipeline de negocios</p>
        </div>
        <Link href="/oportunidades/nueva" className="btn-gold text-sm md:text-base">
          <i className="fas fa-plus mr-2"></i>Nueva oportunidad
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {oportunidades.map((o) => {
          const dias = diasEjecucion(o.fechaInicioPlaneada, o.fechaFinPlaneada);
          const activa = o.estado === "ACTIVA";
          return (
            <div key={o.id} className="glass-card p-5 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`status-badge ${activa ? "status-activo" : "status-cerrado"}`}>
                  {activa ? "Activa" : "Finalizada"}
                </span>
                <span className="text-xs text-white/40">{o.codigo}</span>
              </div>

              <h3 className="font-bold text-lg mb-1">{o.nombre}</h3>
              <p className="text-sm text-white/50 mb-4">{o.entidadContratante}</p>

              <div className="space-y-2 text-sm mb-5">
                <div className="flex justify-between">
                  <span className="text-white/40">Valor estimado</span>
                  <span className="text-[var(--gold-light)] font-semibold">{formatCOP(o.valorEstimado) || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Ejecución</span>
                  <span className="text-white/70">{dias !== null ? `${dias} días` : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Entrega</span>
                  <span className="text-white/70">{formatDateDisplay(o.fechaFinPlaneada)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Responsable</span>
                  <span className="text-white/70">{o.responsable?.nombre || "-"}</span>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push(`/oportunidades/${o.id}`)}
                    className="btn-secondary text-xs py-2"
                  >
                    <i className="fas fa-pen mr-1"></i>Editar
                  </button>
                  {activa && (
                    <button
                      onClick={() => finalizar(o.id)}
                      className="btn-secondary text-xs py-2"
                    >
                      <i className="fas fa-lock mr-1"></i>Finalizar
                    </button>
                  )}
                </div>
                <Link
                  href={`/proyectos/nuevo?oportunidadId=${o.id}`}
                  className="btn-primary text-xs py-2 inline-flex justify-center"
                >
                  <i className="fas fa-rocket mr-2"></i>Crear proyecto
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {oportunidades.length === 0 && (
        <div className="glass-card p-10 text-center mt-8">
          <p className="text-white/50">No hay oportunidades. Crea la primera.</p>
        </div>
      )}
    </div>
  );
}
