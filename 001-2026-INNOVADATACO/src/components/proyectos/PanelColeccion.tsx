"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";

/**
 * Panel genérico de una colección colgada de un proyecto (spec 008, US4/US5/US6).
 *
 * Cronograma, recursos y lecciones son la misma interacción —listar, añadir,
 * borrar— sobre campos distintos. En vez de tres componentes casi iguales, uno
 * que recibe la descripción de sus campos. El presupuesto **no** usa esto: tiene
 * su propio panel porque muestra totales y desviación.
 */

export interface CampoColeccion {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "date" | "number" | "select";
  opciones?: readonly string[];
  /** Ocupa las dos columnas de la rejilla. */
  ancho?: boolean;
  requerido?: boolean;
}

export interface PanelColeccionProps<T> {
  proyectoId: string;
  /** Segmento de la ruta: `/api/projects/[id]/<recurso>`. */
  recurso: string;
  titulo: string;
  campos: CampoColeccion[];
  /** Cómo se resume cada elemento en la lista. */
  render: (item: T) => ReactNode;
  vacio: string;
}

interface ConId {
  id: string;
}

export default function PanelColeccion<T extends ConId>({
  proyectoId,
  recurso,
  titulo,
  campos,
  render,
  vacio,
}: PanelColeccionProps<T>) {
  const inicial = Object.fromEntries(campos.map((c) => [c.nombre, ""])) as Record<string, string>;

  const [items, setItems] = useState<T[]>([]);
  const [form, setForm] = useState<Record<string, string>>(inicial);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${proyectoId}/${recurso}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`[Proyectos] ${recurso}: error — no se pudo cargar`, err);
      setError("No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [proyectoId, recurso]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const crear = async () => {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/projects/${proyectoId}/${recurso}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        // El servidor ya devuelve un mensaje legible por contrato (apiError).
        const cuerpo = await res.json().catch(() => ({}));
        setError(typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo guardar.");
        return;
      }
      setForm(inicial);
      await cargar();
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    const res = await fetch(`/api/projects/${proyectoId}/${recurso}/${id}`, { method: "DELETE" });
    if (res.ok) await cargar();
    else setError("No se pudo eliminar.");
  };

  const requeridosCompletos = campos
    .filter((c) => c.requerido)
    .every((c) => (form[c.nombre] || "").trim() !== "");

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-neonCyan" />
      ) : items.length === 0 ? (
        <p className="text-[10px] text-[#444] uppercase tracking-widest">{vacio}</p>
      ) : (
        <ul className="space-y-2 max-h-44 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 bg-white/5 border border-white/5 p-2"
            >
              <div className="flex-1 min-w-0">{render(item)}</div>
              <button
                type="button"
                aria-label={`Eliminar de ${titulo}`}
                onClick={() => eliminar(item.id)}
                className="text-[#444] hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        {campos.map((campo) => (
          <div key={campo.nombre} className={campo.ancho ? "col-span-2" : ""}>
            {campo.tipo === "select" ? (
              <select
                aria-label={campo.etiqueta}
                value={form[campo.nombre]}
                onChange={(e) => setForm({ ...form, [campo.nombre]: e.target.value })}
                className="w-full bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
              >
                <option value="">{campo.etiqueta}</option>
                {campo.opciones?.map((opcion) => (
                  <option key={opcion} value={opcion}>{opcion}</option>
                ))}
              </select>
            ) : (
              <input
                type={campo.tipo || "text"}
                aria-label={campo.etiqueta}
                placeholder={campo.etiqueta}
                value={form[campo.nombre]}
                onChange={(e) => setForm({ ...form, [campo.nombre]: e.target.value })}
                className="w-full bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
              />
            )}
          </div>
        ))}
        {/* Deshabilitado mientras falte un requerido: el botón no promete lo que
            la ruta va a rechazar con 400 (criterio de I-011). */}
        <button
          type="button"
          onClick={crear}
          disabled={guardando || !requeridosCompletos}
          className="col-span-2 flex items-center justify-center gap-1 bg-neonCyan/10 border border-neonCyan/30 text-neonCyan text-[10px] font-bold uppercase tracking-widest p-2 hover:bg-neonCyan/20 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Añadir
        </button>
      </div>
    </div>
  );
}
