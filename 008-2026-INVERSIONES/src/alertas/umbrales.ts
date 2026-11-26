/**
 * Umbrales del motor de alertas: omisión, rangos y validación. Puro. Cada alerta lleva su interruptor `*Activa`
 * (verdadero por omisión). Los porcentajes son sobre el precio de referencia; no son una recomendación.
 */
export interface Umbrales {
  readonly alertaCercaPct: number;
  readonly alertaCercaActiva: boolean;
  readonly alertaNivelCruzadoActiva: boolean;
  readonly alertaMovimientoPct: number;
  readonly alertaMovimientoActiva: boolean;
  readonly alertaCaidaPct: number;
  readonly alertaCaidaActiva: boolean;
  readonly alertaDatoViejoMin: number;
  readonly alertaDatoViejoActiva: boolean;
  readonly alertaExDiasHabiles: number;
  readonly alertaExActiva: boolean;
}

export type CampoNumerico = "alertaCercaPct" | "alertaMovimientoPct" | "alertaCaidaPct" | "alertaDatoViejoMin" | "alertaExDiasHabiles";

export const RANGOS_UMBRALES: Readonly<Record<CampoNumerico, { readonly min: number; readonly max: number; readonly entero: boolean }>> = Object.freeze({
  alertaCercaPct: { min: 0.5, max: 10, entero: false },
  alertaMovimientoPct: { min: 0.5, max: 20, entero: false },
  alertaCaidaPct: { min: 0.5, max: 20, entero: false },
  alertaDatoViejoMin: { min: 10, max: 240, entero: true },
  alertaExDiasHabiles: { min: 1, max: 10, entero: true },
});

export const UMBRALES_OMISION: Umbrales = Object.freeze({
  alertaCercaPct: 3, alertaCercaActiva: true,
  alertaNivelCruzadoActiva: true,
  alertaMovimientoPct: 3, alertaMovimientoActiva: true,
  alertaCaidaPct: 2, alertaCaidaActiva: true,
  alertaDatoViejoMin: 30, alertaDatoViejoActiva: true,
  alertaExDiasHabiles: 3, alertaExActiva: true,
});

export type ResultadoUmbrales = { readonly ok: true; readonly umbrales: Umbrales } | { readonly ok: false; readonly errores: readonly string[] };

const CAMPOS_ACTIVA = ["alertaCercaActiva", "alertaNivelCruzadoActiva", "alertaMovimientoActiva", "alertaCaidaActiva", "alertaDatoViejoActiva", "alertaExActiva"] as const;

/** Valida una entrada parcial (lo que falta toma la omisión). Acumula todos los errores. */
export function validarUmbrales(entrada: unknown): ResultadoUmbrales {
  if (entrada === null || entrada === undefined) return { ok: true, umbrales: { ...UMBRALES_OMISION } };
  if (typeof entrada !== "object" || Array.isArray(entrada)) return { ok: false, errores: ["los umbrales deben ser un objeto"] };
  const crudo = entrada as Record<string, unknown>;
  const errores: string[] = [];
  const salida: Record<string, number | boolean> = { ...UMBRALES_OMISION };
  for (const clave of Object.keys(crudo)) {
    if (!(clave in UMBRALES_OMISION)) errores.push(`${clave}: umbral desconocido`);
  }
  for (const [campo, { min, max, entero }] of Object.entries(RANGOS_UMBRALES)) {
    if (!(campo in crudo)) continue;
    const v = crudo[campo];
    if (typeof v !== "number" || !Number.isFinite(v)) errores.push(`${campo}: debe ser un número`);
    else if (v < min || v > max) errores.push(`${campo}: debe estar entre ${min} y ${max}`);
    else if (entero && !Number.isInteger(v)) errores.push(`${campo}: debe ser un entero`);
    else salida[campo] = v;
  }
  for (const campo of CAMPOS_ACTIVA) {
    if (!(campo in crudo)) continue;
    if (typeof crudo[campo] !== "boolean") errores.push(`${campo}: debe ser verdadero o falso`);
    else salida[campo] = crudo[campo];
  }
  return errores.length > 0 ? { ok: false, errores } : { ok: true, umbrales: salida as unknown as Umbrales };
}
