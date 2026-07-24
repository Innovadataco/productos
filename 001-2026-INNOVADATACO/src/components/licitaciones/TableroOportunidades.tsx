"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { tarjetasHuerfanas } from "@/lib/kanban";
import {
  columnasDeEstados,
  tarjetasDeOportunidades,
  type EstadoCatalogo,
  type OportunidadTablero,
} from "@/lib/tableroOportunidades";

/**
 * Adaptador de Oportunidades sobre el tablero genérico (spec 007, FR-002).
 *
 * Aquí vive TODO lo específico del dominio: cargar el catálogo y las
 * oportunidades, traducirlas a columnas/tarjetas y persistir el movimiento. El
 * `KanbanBoard` no sabe nada de esto (RZ-1).
 *
 * La persistencia usa el mecanismo existente —`PATCH /api/licitaciones/[id]`—
 * para no saltarse las validaciones de la ruta (US2-6).
 */

/**
 * El listado devuelve hoy un arreglo. Cuando SPEC-009 lo pagine (§3.3) pasará a
 * `{ items, pagination }`: se aceptan las dos formas para que el tablero no se
 * rompa en ese cambio, y se pide el máximo de página (100) desde ya.
 */
function listaDeRespuesta<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export default function TableroOportunidades() {
  const [oportunidades, setOportunidades] = useState<OportunidadTablero[]>([]);
  const [estados, setEstados] = useState<EstadoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [opRes, estRes] = await Promise.all([
          fetch("/api/licitaciones?pageSize=100"),
          fetch("/api/licitaciones/estados"),
        ]);
        if (opRes.ok) setOportunidades(listaDeRespuesta<OportunidadTablero>(await opRes.json()));
        if (estRes.ok) setEstados(listaDeRespuesta<EstadoCatalogo>(await estRes.json()));
      } catch (err) {
        console.error("[Oportunidades] Tablero: error — no se pudo cargar", err);
        setError("No se pudo cargar el tablero.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const columnas = columnasDeEstados(estados);
  const tarjetas = tarjetasDeOportunidades(oportunidades);
  const huerfanas = tarjetasHuerfanas(columnas, tarjetas);

  /**
   * Movimiento optimista con rollback (FR-008): la tarjeta se mueve en la vista
   * al instante y, si la persistencia falla, VUELVE a su columna original. La UI
   * nunca queda mintiendo un estado que no se guardó.
   */
  const moverOportunidad = async (tarjetaId: string, columnaDestinoId: string) => {
    const previas = oportunidades;
    const destinoId = Number(columnaDestinoId);

    setError(null);
    setMoviendoId(tarjetaId);
    setOportunidades((actuales) =>
      actuales.map((op) => (op.id === tarjetaId ? { ...op, estadoId: destinoId } : op)),
    );

    try {
      const res = await fetch(`/api/licitaciones/${tarjetaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoId: destinoId }),
      });
      if (!res.ok) {
        setOportunidades(previas);
        // Mensaje propio: nunca se muestra el detalle técnico del servidor (§0.3).
        setError(
          res.status === 401
            ? "La sesión expiró. Vuelve a entrar para mover oportunidades."
            : "No se pudo guardar el cambio de estado. La tarjeta volvió a su columna.",
        );
      }
    } catch (err) {
      console.error("[Oportunidades] Mover tarjeta: error — la persistencia falló", err);
      setOportunidades(previas);
      setError("No se pudo guardar el cambio de estado. La tarjeta volvió a su columna.");
    } finally {
      setMoviendoId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {error && (
        <div className="glass-panel p-3 border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {huerfanas.length > 0 && (
        <div className="glass-panel p-3 border-yellow-500/30 text-yellow-400/80 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {huerfanas.length} oportunidad(es) apuntan a un estado que ya no está en el catálogo y
          no se muestran en el tablero. Edítalas desde el listado para reasignarles estado.
        </div>
      )}

      <KanbanBoard
        columnas={columnas}
        tarjetas={tarjetas}
        onMover={moverOportunidad}
        moviendoId={moviendoId}
        mensajeVacio="No hay estados en el catálogo. Crea uno en el submódulo Estados para ver el tablero."
      />
    </div>
  );
}
