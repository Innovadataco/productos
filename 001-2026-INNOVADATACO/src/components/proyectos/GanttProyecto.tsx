"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  rangoDeItems,
  posicionItem,
  fraccionAvance,
  posicionHoy,
  ticks,
  type ItemGantt,
  type EscalaGantt,
  type RangoGantt,
} from "@/lib/gantt";
import {
  moverBarra,
  redimensionar,
  detectarConflictos,
  snap,
} from "@/lib/ganttInteractivo";
import {
  entregablesAItems,
  hitosAItems,
  entregablesSinFecha,
  type EntregableGantt,
  type HitoGantt,
} from "@/lib/ganttAdaptador";

/**
 * Gantt interactivo (spec 016). La matemática de posición (ida, spec 015) y de
 * arrastre (vuelta, spec 016) es toda pura; aquí solo va el estado de
 * interacción del ratón, la persistencia optimista-con-rollback (patrón del
 * Kanban) y el señalado de conflictos. Cero dependencias: puntero nativo.
 */

const ESCALAS: Array<{ id: EscalaGantt; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

const pct = (fraccion: number) => `${(fraccion * 100).toFixed(3)}%`;
const iso = (d: Date) => d.toISOString();

type FechasItem = { inicio: Date; fin: Date | null };
type ModoArrastre = "mover" | "inicio" | "fin";
interface Arrastre {
  itemId: string;
  modo: ModoArrastre;
  /** Distancia (en fracción) entre el puntero y el inicio de la barra al agarrar. */
  offset: number;
}

/** Traduce el id de item del Gantt (`entregable:x`|`hito:y`) al PATCH que persiste. */
function patchDeItem(
  proyectoId: string,
  item: ItemGantt,
  fechas: FechasItem,
): { url: string; body: Record<string, string> } | null {
  const [tipo, realId] = item.id.split(":");
  if (tipo === "entregable") {
    return {
      url: `/api/projects/${proyectoId}/entregables/${realId}`,
      body: { fechaInicio: iso(fechas.inicio), fechaCompromiso: fechas.fin ? iso(fechas.fin) : "" },
    };
  }
  if (tipo === "hito") {
    return {
      url: `/api/projects/${proyectoId}/hitos/${realId}`,
      body: { fecha: iso(fechas.inicio), fechaFin: fechas.fin ? iso(fechas.fin) : "" },
    };
  }
  return null;
}

function patchDependencia(proyectoId: string, item: ItemGantt, dependeDe: string) {
  const [tipo, realId] = item.id.split(":");
  const seg = tipo === "entregable" ? "entregables" : "hitos";
  return { url: `/api/projects/${proyectoId}/${seg}/${realId}`, body: { dependeDe } };
}

export default function GanttProyecto({ proyectoId }: { proyectoId: string }) {
  const [entregables, setEntregables] = useState<EntregableGantt[]>([]);
  const [hitos, setHitos] = useState<HitoGantt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escala, setEscala] = useState<EscalaGantt>("semana");
  const [hoy] = useState<Date>(() => new Date());

  // Estado de interacción: la barra en arrastre, sus fechas de vista previa
  // (optimista) y cuál se está persistiendo.
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [preview, setPreview] = useState<Record<string, FechasItem>>({});
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);

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

  const itemsBase: ItemGantt[] = useMemo(
    () => [...entregablesAItems(entregables), ...hitosAItems(hitos)],
    [entregables, hitos],
  );
  // Vista con la previsualización del arrastre aplicada.
  const items: ItemGantt[] = useMemo(
    () => itemsBase.map((i) => (preview[i.id] ? { ...i, ...preview[i.id] } : i)),
    [itemsBase, preview],
  );
  const rango = useMemo(() => rangoDeItems(items, hoy), [items, hoy]);
  const marcas = useMemo(() => (rango ? ticks(rango, escala) : []), [rango, escala]);
  const hoyFrac = useMemo(() => (rango ? posicionHoy(rango, hoy) : null), [rango, hoy]);
  const conflictos = useMemo(() => detectarConflictos(items), [items]);
  const sinFecha = entregablesSinFecha(entregables);

  /** Fracción 0..1 del puntero dentro del lienzo. */
  const fraccionPuntero = useCallback((clientX: number): number | null => {
    const rect = lienzoRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const iniciarArrastre = (
    e: React.PointerEvent,
    item: ItemGantt,
    modo: ModoArrastre,
    rangoActual: RangoGantt,
  ) => {
    if (moviendoId) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const fp = fraccionPuntero(e.clientX) ?? 0;
    const izquierda = posicionItem(item, rangoActual).left;
    setArrastre({ itemId: item.id, modo, offset: fp - izquierda });
  };

  const arrastrar = (e: React.PointerEvent, rangoActual: RangoGantt) => {
    if (!arrastre) return;
    const item = itemsBase.find((i) => i.id === arrastre.itemId);
    if (!item) return;
    const fp = fraccionPuntero(e.clientX);
    if (fp === null) return;

    let fechas: FechasItem;
    if (arrastre.modo === "mover") {
      fechas = moverBarra(item, fp - arrastre.offset, rangoActual, escala);
    } else {
      fechas = redimensionar(item, arrastre.modo, fp, rangoActual, escala);
    }
    setPreview((prev) => ({ ...prev, [arrastre.itemId]: fechas }));
  };

  const soltarArrastre = async () => {
    if (!arrastre) return;
    const itemId = arrastre.itemId;
    const item = itemsBase.find((i) => i.id === itemId);
    const fechas = preview[itemId];
    setArrastre(null);
    if (!item || !fechas) return;

    // Nada que persistir si no se movió respecto a lo original.
    const sinCambio =
      snap(item.inicio, escala).getTime() === snap(fechas.inicio, escala).getTime() &&
      (item.fin?.getTime() ?? 0) === (fechas.fin?.getTime() ?? 0);
    if (sinCambio) {
      setPreview((prev) => quitar(prev, itemId));
      return;
    }

    const patch = patchDeItem(proyectoId, item, fechas);
    if (!patch) return;

    setMoviendoId(itemId);
    setError(null);
    try {
      const res = await fetch(patch.url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch.body),
      });
      if (!res.ok) {
        // Rollback: se quita la previsualización y la barra vuelve a su sitio.
        setPreview((prev) => quitar(prev, itemId));
        setError(
          res.status === 401
            ? "La sesión expiró. Vuelve a entrar para mover fechas."
            : "No se pudo guardar la fecha nueva. La barra volvió a su sitio.",
        );
      } else {
        // Persistido: recargar para sincronizar y limpiar la previsualización.
        await cargar();
        setPreview((prev) => quitar(prev, itemId));
      }
    } catch (err) {
      console.error("[Proyectos] Gantt: error — la persistencia falló", err);
      setPreview((prev) => quitar(prev, itemId));
      setError("No se pudo guardar la fecha nueva. La barra volvió a su sitio.");
    } finally {
      setMoviendoId(null);
    }
  };

  const cambiarDependencia = async (item: ItemGantt, dependeDe: string) => {
    const patch = patchDependencia(proyectoId, item, dependeDe);
    setError(null);
    const res = await fetch(patch.url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch.body),
    });
    if (res.ok) await cargar();
    else setError("No se pudo guardar la dependencia.");
  };

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
        <span className="text-[8px] text-foreground/30 uppercase tracking-widest hidden sm:block">
          Arrastra una barra para mover · sus bordes para redimensionar
        </span>
        {sinFecha > 0 && (
          <span className="text-[9px] text-yellow-400/70 uppercase tracking-widest">
            {sinFecha} sin fecha, fuera del Gantt
          </span>
        )}
      </div>

      {!rango ? (
        <div className="glass-panel p-10 text-center text-[#444] font-geist-mono text-xs uppercase tracking-widest">
          Sin cronograma que dibujar. Añade fechas a los entregables o hitos.
        </div>
      ) : (
        <div className="glass-panel p-4 overflow-x-auto">
          <div className="min-w-[680px]" ref={lienzoRef}>
            {/* Cabecera de fechas */}
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

            <div className="relative space-y-2">
              {hoyFrac !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-neonCyan/60 z-10" style={{ left: pct(hoyFrac) }}>
                  <span className="absolute -translate-x-1/2 -translate-y-full text-[7px] font-black uppercase tracking-widest text-neonCyan">
                    Hoy
                  </span>
                </div>
              )}

              {items.map((item) => {
                const pos = posicionItem(item, rango);
                const enConflicto = conflictos.has(item.id);
                const persistiendo = moviendoId === item.id;
                const otros = items.filter((o) => o.id !== item.id);

                return (
                  <div key={item.id} className="relative h-7 flex items-center">
                    {item.tipo === "hito" && pos.width === 0 ? (
                      // Rombo puntual: se mueve arrastrándolo.
                      <div
                        className="absolute touch-none"
                        style={{ left: pct(pos.left) }}
                        onPointerDown={(e) => iniciarArrastre(e, item, "mover", rango)}
                        onPointerMove={(e) => arrastrar(e, rango)}
                        onPointerUp={soltarArrastre}
                      >
                        <div
                          className={`w-3 h-3 rotate-45 -translate-x-1/2 cursor-grab active:cursor-grabbing ${
                            enConflicto ? "bg-red-400" : "bg-purple-400"
                          } ${persistiendo ? "opacity-40" : ""}`}
                        />
                      </div>
                    ) : (
                      // Barra (entregable o hito con rango): cuerpo mueve, bordes redimensionan.
                      <div
                        className={`absolute h-5 rounded border overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing ${
                          enConflicto ? "border-red-400 bg-red-500/10" : "border-white/20 bg-white/10"
                        } ${persistiendo ? "opacity-40 cursor-wait" : ""}`}
                        style={{ left: pct(pos.left), width: pct(Math.max(pos.width, 0.01)) }}
                        onPointerDown={(e) => iniciarArrastre(e, item, "mover", rango)}
                        onPointerMove={(e) => arrastrar(e, rango)}
                        onPointerUp={soltarArrastre}
                      >
                        {item.tipo === "barra" && (
                          <div className="h-full bg-neonCyan/40 pointer-events-none" style={{ width: pct(fraccionAvance(item)) }} />
                        )}
                        {/* Asas de redimensión (FR-001) */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20"
                          onPointerDown={(e) => iniciarArrastre(e, item, "inicio", rango)}
                          onPointerMove={(e) => arrastrar(e, rango)}
                          onPointerUp={soltarArrastre}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20"
                          onPointerDown={(e) => iniciarArrastre(e, item, "fin", rango)}
                          onPointerMove={(e) => arrastrar(e, rango)}
                          onPointerUp={soltarArrastre}
                        />
                      </div>
                    )}

                    {/* Etiqueta + selector de dependencia (FR-003) */}
                    <div
                      className="absolute flex items-center gap-1 pointer-events-none"
                      style={{ left: `calc(${pct(Math.min(pos.left + Math.max(pos.width, 0.02), 0.75))} + 8px)` }}
                    >
                      <span className={`text-[9px] truncate max-w-[120px] ${enConflicto ? "text-red-300" : "text-foreground/70"}`}>
                        {item.label}
                      </span>
                      <select
                        value={item.dependeDe ?? ""}
                        onChange={(e) => cambiarDependencia(item, e.target.value)}
                        title="Depende de (fin → inicio)"
                        className="pointer-events-auto bg-transparent text-[8px] text-foreground/30 hover:text-neonCyan outline-none cursor-pointer max-w-[70px]"
                      >
                        <option value="" className="bg-[#0a0a0a]">— dep.</option>
                        {otros.map((o) => (
                          <option key={o.id} value={o.id} className="bg-[#0a0a0a]">
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {enConflicto && (
                        <span className="text-[7px] font-black uppercase tracking-widest text-red-400">conflicto</span>
                      )}
                    </div>
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

function quitar(prev: Record<string, FechasItem>, id: string): Record<string, FechasItem> {
  const copia = { ...prev };
  delete copia[id];
  return copia;
}
