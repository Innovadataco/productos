"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCOP, diasEjecucion } from "../../lib/format";

interface Oportunidad {
  id: string;
  codigo: string;
  nombre: string;
  modalidad: string;
  entidadContratante: string;
  estado: string;
  valorEstimado: number | null;
  fechaInicioPlaneada: string | null;
  fechaFinPlaneada: string | null;
}

const columnas = [
  { key: "IDENTIFICADA", label: "Identificada", class: "status-identificada" },
  { key: "EN_PROPUESTA", label: "En propuesta", class: "status-propuesta" },
  { key: "PRESENTADA", label: "Presentada", class: "status-presentada" },
  { key: "ADJUDICADA", label: "Adjudicada", class: "status-adjudicada" },
  { key: "NO_ADJUDICADA", label: "No adjudicada", class: "status-no-adjudicada" },
  { key: "CERRADA", label: "Cerrada", class: "status-cerrada" },
];

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

  if (cargando) return <div className="page-enter text-white/50">Cargando oportunidades...</div>;

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Oportunidades</h2>
          <p className="text-white/50 text-sm md:text-base">Pipeline de negocios</p>
        </div>
        <div className="flex gap-3">
          <Link href="/oportunidades/nueva" className="btn-gold text-sm md:text-base">
            <i className="fas fa-plus mr-2"></i>Nueva
          </Link>
        </div>
      </header>

      <div className="kanban-board">
        {columnas.map((col) => (
          <div key={col.key} className="kanban-column">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white/80 text-sm">{col.label}</h3>
              <span className={`status-badge ${col.class}`}>
                {oportunidades.filter((o) => o.estado === col.key).length}
              </span>
            </div>
            <div className="kanban-cards">
              {oportunidades
                .filter((o) => o.estado === col.key)
                .map((o) => {
                  const dias = diasEjecucion(o.fechaInicioPlaneada, o.fechaFinPlaneada);
                  return (
                    <div
                      key={o.id}
                      onClick={() => router.push(`/oportunidades/${o.id}`)}
                      className="kanban-card cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`status-badge ${col.class}`}>{col.label}</span>
                        <span className="text-xs text-white/40">{o.codigo}</span>
                      </div>
                      <h4 className="font-bold mb-1 text-sm md:text-base text-white">{o.nombre}</h4>
                      <p className="text-xs md:text-sm text-white/50 mb-3">{o.entidadContratante}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <span className="text-[var(--gold-light)] font-semibold">{formatCOP(o.valorEstimado) || "-"}</span>
                        <span className="text-white/40 text-right">{dias !== null ? `${dias} días` : "-"}</span>
                      </div>
                      <Link
                        href={`/proyectos/nuevo?oportunidadId=${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-primary w-full text-xs py-2"
                      >
                        <i className="fas fa-rocket mr-2"></i>Crear proyecto
                      </Link>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
