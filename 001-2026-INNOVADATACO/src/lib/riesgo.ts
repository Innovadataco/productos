/**
 * Validación de riesgos de proyecto (spec 014, US3 / FR-004).
 *
 * Pura y aparte de la ruta, como `entregable.ts` y `proyectoPm2.ts`.
 */

/** Valores admitidos (decisión del CEO, D-073). */
export const PROBABILIDADES_RIESGO = ["alta", "media", "baja"] as const;
export const IMPACTOS_RIESGO = ["alto", "medio", "bajo"] as const;
export const ESTADOS_RIESGO = ["abierto", "mitigado", "cerrado"] as const;

export interface DatosRiesgo {
  descripcion: string;
  probabilidad: string;
  impacto: string;
  mitigacion: string;
  estado: string;
}

function comoObjeto(datos: unknown): Record<string, unknown> | null {
  return typeof datos === "object" && datos !== null ? (datos as Record<string, unknown>) : null;
}

function esVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === "";
}

/** Mensaje del primer problema, o `null` si es válido. */
export function validarRiesgo(datos: unknown): string | null {
  const d = comoObjeto(datos);
  if (!d) return "Datos del riesgo inválidos";

  if (typeof d.descripcion !== "string" || d.descripcion.trim() === "") {
    return "La descripción del riesgo es obligatoria";
  }
  if (
    !esVacio(d.probabilidad) &&
    !PROBABILIDADES_RIESGO.includes(String(d.probabilidad) as (typeof PROBABILIDADES_RIESGO)[number])
  ) {
    return `Probabilidad no válida. Admitidas: ${PROBABILIDADES_RIESGO.join(", ")}`;
  }
  if (
    !esVacio(d.impacto) &&
    !IMPACTOS_RIESGO.includes(String(d.impacto) as (typeof IMPACTOS_RIESGO)[number])
  ) {
    return `Impacto no válido. Admitidos: ${IMPACTOS_RIESGO.join(", ")}`;
  }
  if (
    !esVacio(d.estado) &&
    !ESTADOS_RIESGO.includes(String(d.estado) as (typeof ESTADOS_RIESGO)[number])
  ) {
    return `Estado no válido. Admitidos: ${ESTADOS_RIESGO.join(", ")}`;
  }
  return null;
}

/** Normaliza lo validado a los campos que persiste Prisma. */
export function datosRiesgo(datos: Record<string, unknown>): DatosRiesgo {
  return {
    descripcion: String(datos.descripcion).trim(),
    probabilidad: datos.probabilidad ? String(datos.probabilidad) : "media",
    impacto: datos.impacto ? String(datos.impacto) : "medio",
    mitigacion: datos.mitigacion ? String(datos.mitigacion) : "",
    estado: datos.estado ? String(datos.estado) : "abierto",
  };
}

/**
 * ¿Cuenta este riesgo como "abierto" en la cartera? (FR-005)
 * Abierto y mitigado sí; cerrado no.
 */
export function esRiesgoAbierto(estado: string): boolean {
  return estado !== "cerrado";
}
