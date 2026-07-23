import { envOr } from "@/lib/env";

/// Parámetros de las colas de reporte (D-019b): PARAMETRIZABLES por env y COMPARTIDOS por las
/// tres colas (despachos, llegadas, mantenimientos). Se leen en cada invocación (no al cargar el
/// módulo) para que valgan en worker y tests sin reiniciar. Defaults del legacy: 3 y 5 min.
export function colaMaxReintentos(): number {
  const n = Number(envOr("COLA_MAX_REINTENTOS", "3"));
  return Number.isInteger(n) && n > 0 ? n : 3;
}

export function colaBackoffMin(): number {
  const n = Number(envOr("COLA_BACKOFF_MIN", "5"));
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function colaBackoffMs(): number {
  return colaBackoffMin() * 60_000;
}
