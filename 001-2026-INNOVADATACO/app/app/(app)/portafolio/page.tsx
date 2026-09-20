"use client";

import { useState } from "react";
import Link from "next/link";
import { proyectos, statusClass } from "../../lib/data";

export default function PortafolioPage() {
  const [filtro, setFiltro] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const filtrados = proyectos.filter((p) => {
    const matchFiltro = filtro === "Todos" || p.estado === filtro;
    const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          p.cliente.toLowerCase().includes(busqueda.toLowerCase());
    return matchFiltro && matchBusqueda;
  });

  const filtros = ["Todos", "Activo", "Planificación", "Entregado", "Cerrado"];

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">Portafolio</h2>
          <p className="text-white/50">Gestión de proyectos y clientes</p>
        </div>
        <Link href="/proyectos/nuevo" className="btn-gold">
          <i className="fas fa-plus mr-2" />Nuevo proyecto
        </Link>
      </header>

      <div className="flex flex-wrap gap-3 mb-6">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`btn-secondary ${filtro === f ? "bg-white/10" : ""}`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="text"
          className="input-field"
          style={{ width: 240, padding: "10px 14px" }}
          placeholder="Buscar proyecto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtrados.map((proyecto) => (
          <Link
            key={proyecto.id}
            href={`/proyectos/${proyecto.id}`}
            className="glass-card p-5 block no-underline text-white"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${proyecto.color} flex items-center justify-center text-xl`}>
                <i className={`fas ${proyecto.icono} text-white`} />
              </div>
              <span className={`status-badge ${statusClass(proyecto.estado)}`}>{proyecto.estado}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{proyecto.nombre}</h3>
            <p className="text-white/50 text-sm mb-4">{proyecto.descripcion}</p>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Progreso</span>
              <span className="text-[var(--data-light)]">{proyecto.progreso}%</span>
            </div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${proyecto.progreso}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white/40">
              <span><i className="fas fa-user mr-1" />{proyecto.cliente}</span>
              <span><i className="fas fa-clock mr-1" />{proyecto.hitos.length} hitos</span>
            </div>
          </Link>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="glass-card p-10 text-center mt-8">
          <p className="text-white/50">No se encontraron proyectos.</p>
        </div>
      )}
    </div>
  );
}
