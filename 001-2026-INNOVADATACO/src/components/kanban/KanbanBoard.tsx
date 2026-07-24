"use client";

import { useState } from "react";
import {
  agruparPorColumna,
  esMovimientoReal,
  type ColumnaKanban,
  type TarjetaKanban,
} from "@/lib/kanban";

/**
 * Tablero Kanban GENÉRICO (spec 007, FR-001 / RZ-1).
 *
 * No conoce el dominio: recibe columnas y tarjetas ya normalizadas y emite un
 * evento al soltar una tarjeta en otra columna. No sabe qué es una oportunidad
 * ni una fase, no llama a ninguna API y no decide cómo persistir — de eso se
 * encarga el adaptador que lo usa (US3-2).
 *
 * Sus únicos imports son React y `@/lib/kanban`: eso es lo que acredita SC-008 y
 * lo que permite que SPEC-008 lo reutilice para las fases PM2 sin tocarlo.
 *
 * El arrastre es HTML5 nativo a propósito (plan §"arrastre nativo"): cero
 * dependencias nuevas. El contrato no depende de esa elección; cambiarla no
 * afecta a los consumidores.
 */
interface KanbanBoardProps {
  columnas: ColumnaKanban[];
  tarjetas: TarjetaKanban[];
  /** Se emite SOLO cuando el movimiento es real (columna distinta). */
  onMover: (tarjetaId: string, columnaDestinoId: string) => void;
  /** Tarjeta en vuelo: se atenúa mientras el consumidor persiste. */
  moviendoId?: string | null;
  /** Texto cuando no hay ninguna columna que mostrar. */
  mensajeVacio?: string;
}

const ACENTO_POR_DEFECTO = "bg-white/5 text-foreground/60 border-white/10";

export default function KanbanBoard({
  columnas,
  tarjetas,
  onMover,
  moviendoId = null,
  mensajeVacio = "No hay columnas que mostrar.",
}: KanbanBoardProps) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaSobrevolada, setColumnaSobrevolada] = useState<string | null>(null);

  if (columnas.length === 0) {
    return (
      <div className="glass-panel p-12 text-center text-foreground/30 text-sm">
        {mensajeVacio}
      </div>
    );
  }

  const grupos = agruparPorColumna(columnas, tarjetas);

  const soltarEn = (columnaDestinoId: string) => {
    const tarjetaId = arrastrando;
    setArrastrando(null);
    setColumnaSobrevolada(null);
    if (!tarjetaId) return;
    // FR-009: soltar en la misma columna no es un movimiento. La guarda vive
    // aquí para que ningún consumidor tenga que acordarse de comprobarlo.
    if (!esMovimientoReal(tarjetas, tarjetaId, columnaDestinoId)) return;
    onMover(tarjetaId, columnaDestinoId);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {grupos.map(({ columna, tarjetas: deLaColumna }) => (
        <div
          key={columna.id}
          onDragOver={(e) => {
            e.preventDefault();
            setColumnaSobrevolada(columna.id);
          }}
          onDragLeave={() => setColumnaSobrevolada((actual) => (actual === columna.id ? null : actual))}
          onDrop={() => soltarEn(columna.id)}
          className={`flex-shrink-0 w-72 rounded-lg border transition-colors ${
            columnaSobrevolada === columna.id
              ? "border-neonCyan/50 bg-neonCyan/5"
              : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <header className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
            <span
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${
                columna.acento || ACENTO_POR_DEFECTO
              }`}
            >
              {columna.titulo}
            </span>
            <span className="text-[10px] font-mono text-foreground/30">{deLaColumna.length}</span>
          </header>

          <div className="p-3 space-y-2 min-h-[8rem]">
            {deLaColumna.length === 0 ? (
              <p className="text-[10px] uppercase tracking-widest text-foreground/20 text-center py-6">
                Sin tarjetas
              </p>
            ) : (
              deLaColumna.map((tarjeta) => (
                <article
                  key={tarjeta.id}
                  draggable
                  onDragStart={() => setArrastrando(tarjeta.id)}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setColumnaSobrevolada(null);
                  }}
                  className={`glass-panel p-3 cursor-grab active:cursor-grabbing transition-opacity ${
                    moviendoId === tarjeta.id ? "opacity-40" : "hover:border-white/20"
                  }`}
                >
                  {tarjeta.referencia && (
                    <p className="text-[10px] font-mono text-neonCyan mb-1">{tarjeta.referencia}</p>
                  )}
                  <h4 className="text-white font-bold text-xs leading-snug">{tarjeta.titulo}</h4>
                  {tarjeta.etiqueta && (
                    <p className="text-[10px] text-foreground/40 mt-1 uppercase tracking-wider">
                      {tarjeta.etiqueta}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
