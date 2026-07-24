"use client";

import { useState } from "react";
import {
  agruparPorColumna,
  esMovimientoReal,
  plantillaDeColumnas,
  seRepartenLasColumnas,
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

/** Acento neutro: un estado del catálogo sin color se ve acabado igual (§0.7). */
const ACENTO_NEUTRO = "text-foreground/60";

/**
 * El acento llega como clases de fondo/texto/borde (spec 007). Para usarlo como
 * **acento** y no como bloque plano (spec 012, FR-005) se extrae solo su color
 * de texto, que es el que identifica al estado, y se aplica al punto y al filo
 * superior de la columna.
 */
function colorDeAcento(acento: string | undefined): string {
  return acento?.split(" ").find((clase) => clase.startsWith("text-")) || ACENTO_NEUTRO;
}

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

  // I-014: las columnas reparten el ancho disponible en vez de imponerlo. Solo
  // se vuelve al desplazamiento horizontal cuando el catálogo crece tanto que
  // repartir dejaría las tarjetas ilegibles (FR-012).
  const reparte = seRepartenLasColumnas(columnas.length);

  return (
    <div
      /* Anclas de verificación: `scripts/verify-tableros.mjs` mide I-014 sobre la
         app desplegada y necesita localizar el tablero sin depender de clases de
         maquetado, que es justo lo que la corrección cambia. */
      data-testid="kanban-tablero"
      data-reparte={reparte ? "si" : "no"}
      className={reparte ? "grid gap-4 items-stretch" : "flex gap-4 overflow-x-auto pb-2"}
      style={reparte ? { gridTemplateColumns: plantillaDeColumnas(columnas.length) } : undefined}
    >
      {grupos.map(({ columna, tarjetas: deLaColumna }) => (
        <div
          key={columna.id}
          data-testid="kanban-columna"
          onDragOver={(e) => {
            e.preventDefault();
            setColumnaSobrevolada(columna.id);
          }}
          onDragLeave={() => setColumnaSobrevolada((actual) => (actual === columna.id ? null : actual))}
          onDrop={() => soltarEn(columna.id)}
          className={`group/col rounded-xl border transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none ${
            reparte ? "min-w-0" : "flex-shrink-0 w-72"
          } ${
            columnaSobrevolada === columna.id
              ? "border-neonCyan/60 bg-neonCyan/[0.07] shadow-[0_0_0_1px_rgba(0,240,255,0.15),0_8px_30px_-12px_rgba(0,240,255,0.35)]"
              : "border-white/10 bg-white/[0.02]"
          }`}
        >
          {/* El color del estado acentúa: un punto y el filo superior. Antes era
              un bloque sólido que competía con las tarjetas (FR-005). */}
          <header className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full bg-current shrink-0 ${colorDeAcento(columna.acento)}`}
              />
              <span className="text-[10px] uppercase font-bold tracking-widest text-foreground/70 truncate">
                {columna.titulo}
              </span>
            </span>
            <span className="text-[10px] font-mono text-foreground/25 tabular-nums shrink-0">
              {deLaColumna.length}
            </span>
          </header>
          <div className={`h-px mx-3 bg-current opacity-25 ${colorDeAcento(columna.acento)}`} />

          <div className="p-3 space-y-2 min-h-[8rem] max-h-[26rem] overflow-y-auto">
            {deLaColumna.length === 0 ? (
              /* Vacío compuesto: se lee como zona de destino, no como un fallo
                 de carga (FR-003). Sigue aceptando el arrastre. */
              <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-white/10 text-foreground/20">
                <span aria-hidden className="text-base leading-none">＋</span>
                <p className="text-[9px] uppercase tracking-widest">Suelta una tarjeta aquí</p>
              </div>
            ) : (
              deLaColumna.map((tarjeta) => (
                <article
                  key={tarjeta.id}
                  draggable={moviendoId !== tarjeta.id}
                  onDragStart={() => setArrastrando(tarjeta.id)}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setColumnaSobrevolada(null);
                  }}
                  /* `animate-in` entra al aparecer en la columna destino, así que
                     soltar deja de ser un salto (FR-002). Todo el movimiento se
                     apaga con `motion-reduce` (FR-006). */
                  className={`glass-panel rounded-lg p-3 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200 transition-[transform,box-shadow,opacity,border-color] motion-reduce:transition-none motion-reduce:animate-none ${
                    moviendoId === tarjeta.id
                      ? "opacity-40 cursor-wait"
                      : arrastrando === tarjeta.id
                        ? "cursor-grabbing scale-[1.03] -rotate-1 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] border-neonCyan/40 motion-reduce:scale-100 motion-reduce:rotate-0"
                        : "cursor-grab hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.8)] motion-reduce:hover:translate-y-0"
                  }`}
                >
                  {/* Jerarquía (FR-001): el título manda; referencia y tipo
                      acompañan, cada uno con su peso. */}
                  <h4 className="text-white font-bold text-[13px] leading-snug line-clamp-2">
                    {tarjeta.titulo}
                  </h4>
                  {(tarjeta.referencia || tarjeta.etiqueta) && (
                    <div className="flex items-center gap-2 min-w-0">
                      {tarjeta.referencia && (
                        <span className="text-[10px] font-mono text-foreground/45 shrink-0">
                          {tarjeta.referencia}
                        </span>
                      )}
                      {tarjeta.referencia && tarjeta.etiqueta && (
                        <span aria-hidden className="h-1 w-1 rounded-full bg-white/15 shrink-0" />
                      )}
                      {tarjeta.etiqueta && (
                        <span className="text-[9px] uppercase tracking-wider text-foreground/35 truncate">
                          {tarjeta.etiqueta}
                        </span>
                      )}
                    </div>
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
