"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { ESTADOS_ENTREGABLE } from "@/lib/entregable";

/**
 * Entregables de un proyecto (spec 008, US3).
 *
 * Vive dentro del formulario de edición: un entregable no existe sin su
 * proyecto, igual que la ruta cuelga de `/api/projects/[id]/entregables`.
 */

interface Entregable {
  id: string;
  nombre: string;
  descripcion: string;
  avance: number;
  estado: string;
  fechaCompromiso: string | null;
  responsable: string;
}

const FORM_INICIAL = {
  nombre: "",
  descripcion: "",
  avance: "0",
  estado: "pendiente",
  fechaCompromiso: "",
  responsable: "",
};

export default function EntregablesProyecto({ proyectoId }: { proyectoId: string }) {
  const [entregables, setEntregables] = useState<Entregable[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${proyectoId}/entregables`);
      const data = await res.json();
      setEntregables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Proyectos] Entregables: error — no se pudieron cargar", err);
      setError("No se pudieron cargar los entregables.");
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const crear = async () => {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/projects/${proyectoId}/entregables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        setError(typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo crear el entregable.");
        return;
      }
      setForm(FORM_INICIAL);
      await cargar();
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarAvance = async (entregable: Entregable, avance: number) => {
    const previos = entregables;
    setEntregables((actuales) =>
      actuales.map((e) => (e.id === entregable.id ? { ...e, avance } : e)),
    );
    const res = await fetch(`/api/projects/${proyectoId}/entregables/${entregable.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avance }),
    });
    // Mismo criterio que el tablero: si no se guardó, la vista no lo finge.
    if (!res.ok) {
      setEntregables(previos);
      setError("No se pudo guardar el avance.");
    }
  };

  const eliminar = async (id: string) => {
    const res = await fetch(`/api/projects/${proyectoId}/entregables/${id}`, { method: "DELETE" });
    if (res.ok) await cargar();
    else setError("No se pudo eliminar el entregable.");
  };

  return (
    <div className="space-y-3 pt-4 border-t border-white/10">
      <h3 className="text-[10px] text-[#888] uppercase tracking-widest">Entregables</h3>

      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-neonCyan" />
      ) : entregables.length === 0 ? (
        <p className="text-[10px] text-[#444] uppercase tracking-widest">Sin entregables todavía</p>
      ) : (
        <ul className="space-y-2 max-h-40 overflow-y-auto">
          {entregables.map((e) => (
            <li key={e.id} className="flex items-center gap-3 bg-white/5 border border-white/5 p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{e.nombre}</p>
                <p className="text-[9px] text-[#666] uppercase tracking-widest">
                  {e.estado}
                  {e.responsable ? ` · ${e.responsable}` : ""}
                  {e.fechaCompromiso ? ` · ${new Date(e.fechaCompromiso).toLocaleDateString("es-CO")}` : ""}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={e.avance}
                aria-label={`Avance de ${e.nombre}`}
                onChange={(ev) => cambiarAvance(e, Number(ev.target.value))}
                className="w-14 bg-white/5 border border-white/10 p-1 text-[10px] text-center"
              />
              <span className="text-[9px] text-[#666]">%</span>
              <button
                type="button"
                aria-label={`Eliminar ${e.nombre}`}
                onClick={() => eliminar(e.id)}
                className="text-[#444] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Nombre del entregable"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="col-span-2 bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <input
          placeholder="Responsable"
          value={form.responsable}
          onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          className="bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <input
          type="date"
          aria-label="Fecha de compromiso"
          value={form.fechaCompromiso}
          onChange={(e) => setForm({ ...form, fechaCompromiso: e.target.value })}
          className="bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <select
          value={form.estado}
          aria-label="Estado del entregable"
          onChange={(e) => setForm({ ...form, estado: e.target.value })}
          className="bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        >
          {ESTADOS_ENTREGABLE.map((estado) => (
            <option key={estado} value={estado}>{estado}</option>
          ))}
        </select>
        {/* Alta deshabilitada sin nombre: el botón no promete lo que la ruta
            va a rechazar con 400 (mismo criterio que I-011). */}
        <button
          type="button"
          onClick={crear}
          disabled={guardando || form.nombre.trim() === ""}
          className="flex items-center justify-center gap-1 bg-neonCyan/10 border border-neonCyan/30 text-neonCyan text-[10px] font-bold uppercase tracking-widest p-2 hover:bg-neonCyan/20 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Añadir
        </button>
      </div>
    </div>
  );
}
