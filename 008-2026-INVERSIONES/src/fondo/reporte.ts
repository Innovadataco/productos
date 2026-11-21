/**
 * Reportes de `actualizar-fondo` (la SFC directa) y de la vía B del fondo. Solo conteos, códigos, ids internos,
 * números de línea y fechas: nunca el código de negocio, el nombre del fondo ni valores. Salen con 3 si hay algo
 * que atender (un fondo con fallo, un dato atrasado o ningún fondo).
 */
import { isoDia } from "./sfc";
import { DIAS_ATRASO_AVISO, type ResultadoFondo } from "./guardar";

export const SALIDA_CON_AVISOS = 3;
/** Sin resultado que entregar (p. ej. el exportador no pudo escribir ningún CSV). */
export const SALIDA_FALLIDA = 1;

export interface Reporte {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | typeof SALIDA_FALLIDA | typeof SALIDA_CON_AVISOS;
}

/** El de `actualizar-fondo`: conteos, el último dato de cada fondo y sus fallos. */
export function reporteFondo(r: ResultadoFondo): Reporte {
  if (r.fondos === 0) return { lineas: ["⚠️  SIN_FONDOS: no hay fondos (FIC) activos registrados. Regístrelo con --registrar."], codigoSalida: SALIDA_CON_AVISOS };
  const lineas = [
    `✅ ${r.fondos} fondo(s) · valores nuevos: ${r.valoresNuevos} · revisados: ${r.valoresRevisados}`,
    ...r.ultimos.map((u) => `   · fondo ${u.instrumentoId} · último dato: ${u.ultimaFecha ? isoDia(u.ultimaFecha) : "sin datos"}${u.atrasado ? ` · ATRASADO (más de ${DIAS_ATRASO_AVISO} días)` : ""}`),
    ...r.fallidos.map((f) => `⚠️  fondo ${f.instrumentoId} · ${f.codigo}${f.detalle ? ` · ${f.detalle}` : ""} · guardados: ${f.guardados} · con error: ${f.conError} · descartados: ${f.descartados}`),
  ];
  const conAvisos = r.fallidos.length > 0 || r.ultimos.some((u) => u.atrasado);
  return { lineas, codigoSalida: conAvisos ? SALIDA_CON_AVISOS : 0 };
}
