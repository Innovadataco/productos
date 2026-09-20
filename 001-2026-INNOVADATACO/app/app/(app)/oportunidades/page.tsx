"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Oportunidad {
  id: string;
  codigo: string;
  nombre: string;
  modalidad: string;
  entidadContratante: string;
  estado: string;
  valorEstimado: number | null;
  fechaFinPlaneada: string | null;
  cliente: { nombre: string } | null;
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

  const formatMoney = (val: number | null) => {
    if (val === null) return "-";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val);
  };

  if (cargando) return <div className="page-enter text-white/50">Cargando oportunidades...</div>;

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">Oportunidades</h2>
          <p className="text-white/50">Pipeline de negocios</p>
        </div>
        <div className="flex gap-3">
          <Link href="/portafolio" className="btn-secondary">Proyectos</Link>
          <Link href="/oportunidades/nueva" className="btn-gold">
            <i className="fas fa-plus mr-2"></i>Nueva oportunidad
          </Link>
        </div>
      </header>

      <div className="kanban-scroll flex gap-5 overflow-x-auto pb-4">
        {columnas.map((col) => (
          <div key={col.key} className="kanban-column">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white/80">{col.label}</h3>
              <span className={`status-badge ${col.class}`}>
                {oportunidades.filter((o) => o.estado === col.key).length}
              </span>
            </div>
            {oportunidades
              .filter((o) => o.estado === col.key)
              .map((o) => (
                <Link
                  key={o.id}
                  href={`/oportunidades/${o.id}`}
                  className="kanban-card block no-underline text-white"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`status-badge ${col.class}`}>{col.label}</span>
                    <span className="text-xs text-white/40">{o.codigo}</span>
                  </div>
                  <h4 className="font-bold mb-1">{o.nombre}</h4>
                  <p className="text-sm text-white/50 mb-3">{o.entidadContratante}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--gold-light)] font-semibold">{formatMoney(o.valorEstimado)}</span>
                    <span className="text-white/40">{o.fechaFinPlaneada ? new Date(o.fechaFinPlaneada).toLocaleDateString("es-CO") : "-"}</span>
                  </div>
                </Link>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
