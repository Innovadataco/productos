"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  rangoDeItems,
  posicionItem,
  fraccionAvance,
  posicionHoy,
  ticks,
  type ItemGantt,
  type EscalaGantt,
} from "@/lib/gantt";
import {
  entregablesAItems,
  hitosAItems,
  entregablesSinFecha,
  type EntregableGantt,
  type HitoGantt,
} from "@/lib/ganttAdaptador";

/**
 * Gantt del cronograma de un proyecto (spec 015, solo lectura).
 *
 * Toda la posición y la escala salen de `@/lib/gantt` (funciones puras); aquí
 * solo se traduce el dominio a `ItemGantt` (adaptador) y se pinta con SVG/CSS
 * propio, cero dependencias (RZ-1). SPEC-016 montará el arrastre sobre la misma
 * matemática sin tocarla.
 */

const ESCALAS: Array<{ id: EscalaGantt; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

const pct = (fraccion: number) => `${(fraccion * 100).toFixed(3)}%`;

export default function GanttProyecto({ proyectoId }: { proyectoId: string }) {
  const [entregables, setEntregables] = useState<EntregableGantt[]>([]);
  const [hitos, setHitos] = useState<HitoGantt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escala, setEscala] = useState<EscalaGantt>("semana");
  // "Hoy" se computa UNA vez, en el inicializador perezoso de useState: se
  // ejecuta al montar, no en cada render, así que no es la impureza que React
  // prohíbe (react-hooks/purity) ni un setState síncrono en un efecto (§6.2).
  const [hoy] = useState<Date>(() => new Date());

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [entRes, hitRes] = await Promise.all([
        fetch(`/api/projects/${proyectoId}/entregables`),
        fetch(`/api/projects/${proyectoId}/hitos`),
      ]);
      if (entRes.ok) setEntregables(await entRes.json());
      if (hitRes.ok) setHitos(await hitRes.json());
    } catch (err) {
      console.error("[Proyectos] Gantt: error — no se pudo cargar", err);
      setError("No se pudo cargar el cronograma.");
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const items: ItemGantt[] = useMemo(
    () => [...entregablesAItems(entregables), ...hitosAItems(hitos)],
    [entregables, hitos],
  );
  const rango = useMemo(() => rangoDeItems(items, hoy), [items, hoy]);
  const marcas = useMemo(() => (rango ? ticks(rango, escala) : []), [rango, escala]);
  const hoyFrac = useMemo(() => (rango ? posicionHoy(rango, hoy) : null), [rango, hoy]);
  const sinFecha = entregablesSinFecha(entregables);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="glass-panel p-3 border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {ESCALAS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEscala(e.id)}
              className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
                escala === e.id ? "text-neonCyan border-b border-neonCyan" : "text-white/30 hover:text-white"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        {sinFecha > 0 && (
          <span className="text-[9px] text-yellow-400/70 uppercase tracking-widest">
            {sinFecha} entregable(s) sin fecha, fuera del Gantt
          </span>
        )}
      </div>

      {!rango ? (
        <div className="glass-panel p-10 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
          Sin cronograma que dibujar. Añade fechas a los entregables o hitos.
        </div>
      ) : (
        <div className="glass-panel p-4 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Cabecera de fechas (FR-002) */}
            <div className="relative h-5 border-b border-white/10 mb-2">
              {marcas.map((m, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 text-[8px] font-mono text-foreground/40 whitespace-nowrap"
                  style={{ left: pct(m.fraccion) }}
                >
                  {m.etiqueta}
                </span>
              ))}
            </div>

            {/* Filas de items */}
            <div className="relative space-y-2">
              {/* Línea de HOY (FR-003) */}
              {hoyFrac !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-neonCyan/60 z-10"
                  style={{ left: pct(hoyFrac) }}
                >
                  <span className="absolute -top-0 -translate-x-1/2 -translate-y-full text-[7px] font-black uppercase tracking-widest text-neonCyan">
                    Hoy
                  </span>
                </div>
              )}

              {items.map((item) => {
                const pos = posicionItem(item, rango);
                if (item.tipo === "hito") {
                  return (
                    <div key={item.id} className="relative h-6 flex items-center">
                      {/* Rombo del hito (FR-001) */}
                      <div className="absolute" style={{ left: pct(pos.left) }}>
                        {pos.width > 0 ? (
                          <div
                            className="h-2 rounded-sm bg-purple-400/50 border border-purple-300"
                            style={{ width: pct(pos.width) }}
                          />
                        ) : (
                          <div className="w-2.5 h-2.5 rotate-45 bg-purple-400 -translate-x-1/2" />
                        )}
                      </div>
                      <span
                        className="absolute text-[9px] text-foreground/60 truncate max-w-[40%]"
                        style={{ left: `calc(${pct(pos.left)} + 12px)` }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                }
                // Barra del entregable, con avance dentro (FR-001)
                const avance = fraccionAvance(item);
                return (
                  <div key={item.id} className="relative h-6 flex items-center">
                    <div
                      className="absolute h-4 rounded bg-white/10 border border-white/20 overflow-hidden"
                      style={{ left: pct(pos.left), width: pct(Math.max(pos.width, 0.005)) }}
                    >
                      <div className="h-full bg-neonCyan/40" style={{ width: pct(avance) }} />
                    </div>
                    <span
                      className="absolute text-[9px] text-foreground/70 truncate max-w-[35%] pointer-events-none"
                      style={{ left: `calc(${pct(pos.left)} + 4px)` }}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
