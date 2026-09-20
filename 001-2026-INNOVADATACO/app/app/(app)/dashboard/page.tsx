"use client";

import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { proyectos } from "../../lib/data";

export default function DashboardPage() {
  const { user } = useAuth();
  const activos = proyectos.filter((p) => p.estado === "Activo").length;
  const clientes = new Set(proyectos.map((p) => p.cliente)).size;
  const contratos = proyectos.filter((p) => p.estado !== "Cerrado").length;

  return (
    <div className="page-enter">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">Buen día, {user?.name || "Jelkin"}</h2>
          <p className="text-white/50">Resumen de Innovadataco · septiembre 2026</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <i className="fas fa-bell mr-2" />3
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--data)] to-[var(--gold)] flex items-center justify-center font-bold text-sm">
            {user?.name?.slice(0, 2).toUpperCase() || "JE"}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <div className="text-white/50 text-sm mb-1">Proyectos activos</div>
          <div className="text-3xl font-bold text-[var(--data-light)]">{activos}</div>
          <div className="text-xs text-green-400 mt-2">
            <i className="fas fa-arrow-up mr-1" />+2 este mes
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="text-white/50 text-sm mb-1">Clientes</div>
          <div className="text-3xl font-bold text-[var(--gold-light)]">{clientes}</div>
          <div className="text-xs text-green-400 mt-2">
            <i className="fas fa-arrow-up mr-1" />+4 este mes
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="text-white/50 text-sm mb-1">Contratos vigentes</div>
          <div className="text-3xl font-bold text-white">{contratos}</div>
          <div className="text-xs text-white/40 mt-2">3 por renovar</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-white/50 text-sm mb-1">Ingresos 2026</div>
          <div className="text-3xl font-bold text-white">$1.24M</div>
          <div className="text-xs text-green-400 mt-2">
            <i className="fas fa-arrow-up mr-1" />18% vs 2025
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Proyectos por estado</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>En progreso</span>
                <span className="text-[var(--data-light)]">
                  {proyectos.filter((p) => p.estado === "Activo").length}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "58%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Planificación</span>
                <span className="text-[var(--gold-light)]">
                  {proyectos.filter((p) => p.estado === "Planificación").length}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "25%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Entrega / QA</span>
                <span className="text-white">{proyectos.filter((p) => p.estado === "Entregado").length}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "17%" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Próximos hitos</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-[var(--data)]/20 flex items-center justify-center text-[var(--data-light)]">
                <i className="fas fa-flag" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Lanzamiento PI Web</div>
                <div className="text-xs text-white/40">Viernes 25 sep</div>
              </div>
              <span className="status-badge status-activo">4 días</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold-light)]">
                <i className="fas fa-handshake" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Renovación contrato BI</div>
                <div className="text-xs text-white/40">Martes 30 sep</div>
              </div>
              <span className="status-badge status-planificacion">9 días</span>
            </div>
          </div>
          <Link href="/portafolio" className="btn-secondary w-full mt-4 text-center">
            Ver portafolio
          </Link>
        </div>
      </div>
    </div>
  );
}
