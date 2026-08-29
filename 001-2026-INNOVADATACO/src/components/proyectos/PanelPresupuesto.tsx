"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { ResumenPresupuesto } from "@/lib/proyectoPm2";

/**
 * Presupuesto con control de gasto PM2 (spec 008, US5 / FR-012).
 *
 * Panel propio y no `PanelColeccion` porque lo que aporta es justo lo que
 * aquel no hace: los totales y la **desviación**. Los tres números los calcula
 * el servidor al leer, así que la pantalla no puede sumar distinto que la API.
 */

interface Partida {
  id: string;
  concepto: string;
  montoPlaneado: string | number;
  montoEjecutado: string | number;
  moneda: string;
}

const FORM_INICIAL = { concepto: "", montoPlaneado: "", montoEjecutado: "" };

const pesos = (valor: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(valor);

export default function PanelPresupuesto({ proyectoId }: { proyectoId: string }) {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [resumen, setResumen] = useState<ResumenPresupuesto | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${proyectoId}/partidas`);
      const data = await res.json();
      setPartidas(Array.isArray(data?.partidas) ? data.partidas : []);
      setResumen(data?.resumen ?? null);
    } catch (err) {
      console.error("[Proyectos] Presupuesto: error — no se pudo cargar", err);
      setError("No se pudo cargar el presupuesto.");
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
      const res = await fetch(`/api/projects/${proyectoId}/partidas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        setError(typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo guardar la partida.");
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

  const eliminar = async (id: string) => {
    const res = await fetch(`/api/projects/${proyectoId}/partidas/${id}`, { method: "DELETE" });
    if (res.ok) await cargar();
    else setError("No se pudo eliminar la partida.");
  };

  // Positiva = se gastó de más. Se muestra en rojo porque es una alerta, no un
  // error: el control de gasto informa, no impide (spec, Edge Cases).
  const sobrecoste = (resumen?.desviacion ?? 0) > 0;

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
        </div>
      )}

      {resumen && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 border border-white/5 p-2">
            <p className="text-[8px] uppercase tracking-widest text-[#666]">Planeado</p>
            <p className="text-xs font-bold">{pesos(resumen.totalPlaneado)}</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-2">
            <p className="text-[8px] uppercase tracking-widest text-[#666]">Ejecutado</p>
            <p className="text-xs font-bold">{pesos(resumen.totalEjecutado)}</p>
          </div>
          <div
            className={`border p-2 ${
              sobrecoste ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/20"
            }`}
          >
            <p className="text-[8px] uppercase tracking-widest text-[#666]">Desviación</p>
            <p className={`text-xs font-bold ${sobrecoste ? "text-red-400" : "text-green-400"}`}>
              {sobrecoste ? "+" : ""}
              {pesos(resumen.desviacion)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-neonCyan" />
      ) : partidas.length === 0 ? (
        <p className="text-[10px] text-[#444] uppercase tracking-widest">Sin partidas todavía</p>
      ) : (
        <ul className="space-y-2 max-h-40 overflow-y-auto">
          {partidas.map((p) => (
            <li key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/5 p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{p.concepto}</p>
                <p className="text-[9px] text-[#666] uppercase tracking-widest">
                  {pesos(Number(p.montoPlaneado))} planeado · {pesos(Number(p.montoEjecutado))} ejecutado
                </p>
              </div>
              <button
                type="button"
                aria-label={`Eliminar partida ${p.concepto}`}
                onClick={() => eliminar(p.id)}
                className="text-[#444] hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Concepto"
          aria-label="Concepto"
          value={form.concepto}
          onChange={(e) => setForm({ ...form, concepto: e.target.value })}
          className="col-span-2 bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <input
          type="number"
          min={0}
          placeholder="Planeado"
          aria-label="Monto planeado"
          value={form.montoPlaneado}
          onChange={(e) => setForm({ ...form, montoPlaneado: e.target.value })}
          className="bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <input
          type="number"
          min={0}
          placeholder="Ejecutado"
          aria-label="Monto ejecutado"
          value={form.montoEjecutado}
          onChange={(e) => setForm({ ...form, montoEjecutado: e.target.value })}
          className="bg-white/5 border border-white/10 p-2 text-[10px] focus:border-neonCyan outline-none"
        />
        <button
          type="button"
          onClick={crear}
          disabled={guardando || form.concepto.trim() === ""}
          className="col-span-2 flex items-center justify-center gap-1 bg-neonCyan/10 border border-neonCyan/30 text-neonCyan text-[10px] font-bold uppercase tracking-widest p-2 hover:bg-neonCyan/20 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Añadir partida
        </button>
      </div>
    </div>
  );
}
