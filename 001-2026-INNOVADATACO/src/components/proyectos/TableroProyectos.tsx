"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { tarjetasHuerfanas } from "@/lib/kanban";
import { columnasDeFases, tarjetasDeProyectos, type ProyectoTablero } from "@/lib/tableroProyectos";

/**
 * Tablero de fases PM2 (spec 008, US2).
 *
 * Reutiliza el `KanbanBoard` de SPEC-007 **sin modificarlo** (RZ-2): lo único
 * propio de proyectos es este adaptador. Esa es la prueba real de que el tablero
 * de SPEC-007 era genérico de verdad y no genérico de palabra.
 */
export default function TableroProyectos() {
  const [proyectos, setProyectos] = useState<ProyectoTablero[]>([]);
  const [loading, setLoading] = useState(true);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        // Ante 401 la respuesta es un objeto de error, no un arreglo.
        setProyectos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[Proyectos] Tablero de fases: error — no se pudo cargar", err);
        setError("No se pudo cargar el tablero de fases.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const columnas = columnasDeFases();
  const tarjetas = tarjetasDeProyectos(proyectos);
  const huerfanos = tarjetasHuerfanas(columnas, tarjetas);

  /** Movimiento optimista con rollback (FR-007), igual que en Oportunidades. */
  const moverProyecto = async (tarjetaId: string, faseDestino: string) => {
    const previos = proyectos;

    setError(null);
    setMoviendoId(tarjetaId);
    setProyectos((actuales) =>
      actuales.map((p) => (p.id === tarjetaId ? { ...p, currentPhase: faseDestino } : p)),
    );

    try {
      const res = await fetch(`/api/projects/${tarjetaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPhase: faseDestino }),
      });
      if (!res.ok) {
        setProyectos(previos);
        setError(
          res.status === 401
            ? "La sesión expiró. Vuelve a entrar para mover proyectos."
            : "No se pudo guardar el cambio de fase. La tarjeta volvió a su columna.",
        );
      }
    } catch (err) {
      console.error("[Proyectos] Mover fase: error — la persistencia falló", err);
      setProyectos(previos);
      setError("No se pudo guardar el cambio de fase. La tarjeta volvió a su columna.");
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
      <header className="space-y-1">
        <div className="text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          Gestión Operativa PM²
        </div>
        <h1 className="text-2xl font-bold tracking-tight uppercase">Fases del Proyecto</h1>
      </header>

      {error && (
        <div className="glass-panel p-3 border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {huerfanos.length > 0 && (
        <div className="glass-panel p-3 border-yellow-500/30 text-yellow-400/80 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {huerfanos.length} proyecto(s) tienen una fase que no pertenece a PM² y no se muestran
          en el tablero. Edítalos desde el listado para asignarles una fase.
        </div>
      )}

      <KanbanBoard
        columnas={columnas}
        tarjetas={tarjetas}
        onMover={moverProyecto}
        moviendoId={moviendoId}
      />
    </div>
  );
}
