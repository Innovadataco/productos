"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, LayoutGrid, ShieldAlert } from "lucide-react";
import GestionPm2 from "@/components/proyectos/GestionPm2";

/**
 * Espacio de gestión de proyectos (spec 014): cartera + detalle.
 *
 * La cartera mira todos los proyectos con sus cifras clave; al elegir uno se
 * entra al detalle, que **reutiliza** `GestionPm2` (el mismo de SPEC-008, ya con
 * la pestaña de Riesgos) fuera del modal. No se reescribe nada de la gestión: se
 * mueve de contenedor.
 */

interface FilaCartera {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  fase: string;
  faseNombre: string;
  presupuestoTotal: number;
  avancePromedio: number | null;
  riesgosAbiertos: number;
}

const pesos = (valor: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(valor);

export default function CarteraProyectos() {
  const [filas, setFilas] = useState<FilaCartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<FilaCartera | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects/cartera");
      const data = await res.json();
      setFilas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Proyectos] Cartera: error — no se pudo cargar", err);
      setError("No se pudo cargar la cartera.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  // ── Detalle ────────────────────────────────────────────────────────────────
  if (seleccionado) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => {
            setSeleccionado(null);
            // Al volver, recargar: pudo cambiar el avance o los riesgos.
            void cargar();
          }}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-neonCyan transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Volver a la cartera
        </button>

        <header className="space-y-1">
          <span className="text-[10px] font-geist-mono text-[#666] uppercase tracking-tighter">
            {seleccionado.codigo} · {seleccionado.faseNombre}
          </span>
          <h1 className="text-2xl font-bold tracking-tight uppercase">{seleccionado.nombre}</h1>
          <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">
            {seleccionado.cliente}
          </p>
        </header>

        <GestionPm2 proyectoId={seleccionado.id} />
      </div>
    );
  }

  // ── Cartera ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          Gestión Operativa PM²
        </div>
        <h1 className="text-2xl font-bold tracking-tight uppercase">Cartera de Proyectos</h1>
      </header>

      {error && (
        <div className="glass-panel p-3 border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
        </div>
      ) : filas.length === 0 ? (
        <div className="glass-panel p-12 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
          No hay proyectos que gestionar todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filas.map((fila) => (
            <button
              key={fila.id}
              type="button"
              onClick={() => setSeleccionado(fila)}
              className="glass-panel group p-5 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded bg-white/5 flex items-center justify-center text-neonCyan group-hover:bg-neonCyan/20 transition-colors shrink-0">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-geist-mono text-[#666] uppercase tracking-tighter">
                    {fila.codigo}
                  </span>
                  <h3 className="font-bold tracking-tight text-sm uppercase truncate">{fila.nombre}</h3>
                  <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold truncate">
                    {fila.cliente}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <Metrica etiqueta="Presupuesto" valor={pesos(fila.presupuestoTotal)} />
                <Metrica
                  etiqueta="Avance"
                  valor={fila.avancePromedio === null ? "—" : `${fila.avancePromedio}%`}
                />
                <Metrica
                  etiqueta="Riesgos"
                  valor={String(fila.riesgosAbiertos)}
                  alerta={fila.riesgosAbiertos > 0}
                  icono={fila.riesgosAbiertos > 0}
                />
                <div className="hidden md:flex flex-col items-end gap-1">
                  <span className="text-[8px] text-[#444] uppercase font-black">Fase PM²</span>
                  <div className="px-2 py-0.5 rounded-full bg-neonCyan/10 text-neonCyan text-[9px] font-bold uppercase tracking-tighter">
                    {fila.faseNombre}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#444] group-hover:text-neonCyan transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  alerta = false,
  icono = false,
}: {
  etiqueta: string;
  valor: string;
  alerta?: boolean;
  icono?: boolean;
}) {
  return (
    <div className="hidden sm:flex flex-col items-end gap-0.5">
      <span className="text-[8px] text-[#444] uppercase font-black">{etiqueta}</span>
      <span
        className={`text-sm font-bold tabular-nums flex items-center gap-1 ${
          alerta ? "text-orange-300" : "text-white"
        }`}
      >
        {icono && <ShieldAlert className="w-3 h-3" />}
        {valor}
      </span>
    </div>
  );
}
