"use client";
/**
 * El contador de «Alertas» en el menú: las alertas de los últimos 7 días que nadie marcó como vistas (GET
 * /api/alertas/pendientes, con la sesión de quien mira: el dueño o la familia). Con 0 no se muestra; con N lleva su
 * aria-label. Si la lectura falla o responde otra cosa, no se pinta nada (nunca un número inventado). Se vuelve a leer cuando la
 * pantalla de alertas marca algo (EVENTO_ALERTAS_CAMBIARON). Sin imports de servidor: la ruta es la única que toca la base.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EVENTO_ALERTAS_CAMBIARON } from "./evento";
import "./alertas-contador.css";

const RUTA = "/api/alertas/pendientes";

async function leer(senal: AbortSignal): Promise<number | null> {
  try {
    const r = await fetch(RUTA, { cache: "no-store", credentials: "same-origin", signal: senal });
    if (!r.ok) return null;
    const n = ((await r.json()) as { pendientes?: unknown } | null)?.pendientes;
    return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export const etiquetaContador = (n: number): string => `${n} ${n === 1 ? "alerta sin marcar" : "alertas sin marcar"} de los últimos 7 días`;

export function ContadorAlertas() {
  const [pendientes, setPendientes] = useState<number | null>(null);
  const secuencia = useRef(0);
  const control = useRef<AbortController | null>(null);

  const actualizar = useCallback(async () => {
    control.current?.abort();
    const mia = ++secuencia.current;
    const propio = new AbortController();
    control.current = propio;
    const n = await leer(propio.signal);
    // Solo vale la lectura más reciente: una respuesta vieja que llega tarde no pisa a la nueva.
    if (mia === secuencia.current && !propio.signal.aborted) setPendientes(n);
  }, []);

  useEffect(() => {
    void actualizar();
    const alCambiar = () => void actualizar();
    window.addEventListener(EVENTO_ALERTAS_CAMBIARON, alCambiar);
    return () => {
      window.removeEventListener(EVENTO_ALERTAS_CAMBIARON, alCambiar);
      secuencia.current += 1;
      control.current?.abort();
    };
  }, [actualizar]);

  if (pendientes === null || pendientes === 0) return null;
  return <span className="alertas-contador" role="img" aria-label={etiquetaContador(pendientes)}>{pendientes}</span>;
}
