/**
 * Reportes de `actualizar-fondo` (la SFC directa) y de la vía B del fondo. Solo conteos, códigos, ids internos,
 * números de línea y fechas: nunca el código de negocio, el nombre del fondo ni valores. Salen con 3 si hay algo
 * que atender (un fondo con fallo, un dato atrasado o ningún fondo).
 */
import type { ResultadoExportacionFondo } from "./exportar";
import { DIAS_ATRASO_AVISO, type ResultadoFondo } from "./guardar";
import type { ResultadoImportacionFondo } from "./importar";
import { isoDia } from "./sfc";

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

/** `importar-valores-fondo`: una línea del CSV y, después, exactamente el reporte de `actualizar-fondo`, más los fondos sin guardar. */
export function reporteImportacionFondo(r: ResultadoImportacionFondo): Reporte {
  // Sin ningún fondo registrado, el SIN_FONDOS de actualizar-fondo («Regístrelo con --registrar») no aplica: lo dicen las líneas de abajo.
  const base = r.guardado.fondos > 0 ? reporteFondo(r.guardado) : { lineas: [], codigoSalida: 0 };
  const sinFondo = r.sinFondo.length === 0 ? [] : [
    `⚠️  ${r.sinFondo.length} fondo(s) del CSV sin guardar (no hay un fondo FIC activo con ese código: regístrelo con registrar-fondo):`,
    ...r.sinFondo.map((s) => `   · línea ${s.linea} · ${s.codigo}`),
  ];
  const conAvisos = base.codigoSalida !== 0 || sinFondo.length > 0;
  return { lineas: [`📄 CSV de valores del fondo · filas: ${r.filas} · fondos: ${r.fondosCsv}`, ...base.lineas, ...sinFondo], codigoSalida: conAvisos ? SALIDA_CON_AVISOS : 0 };
}

const SIN_CSV: Readonly<Record<NonNullable<ResultadoExportacionFondo["codigoCsv"]>, string>> = {
  SIN_FILAS: "la SFC no trajo valores en el rango",
  CSV_DEMASIADO_GRANDE: "pida un rango más corto o menos fondos",
  FILA_INVALIDA: "una fila no pasaría la validación del importador",
};

/** `fondo:exportar` (a stderr; el CSV va a stdout): conteos, el último día de cada fondo y los que quedaron fuera, por su línea. */
export function reporteExportacionFondo(r: ResultadoExportacionFondo): Reporte {
  const porLinea = r.porLinea.map((l) =>
    `   · línea ${l.linea} de la lista · valores: ${l.valores} · último día: ${l.ultimaFecha ? isoDia(l.ultimaFecha) : "sin valores"}${l.descartados > 0 ? ` · descartados: ${l.descartados} (SFC_VALOR_INVALIDO)` : ""}`);
  const fallos = r.fallidos.length === 0 ? [] : [`⚠️  ${r.fallidos.length} fondo(s) sin valores en el CSV:`, ...r.fallidos.map((f) => `   · línea ${f.linea} de la lista · ${f.codigo}`)];
  const sinCsv = r.codigoCsv === null ? [] : [`❌ ${r.codigoCsv} · no se escribió el CSV (${SIN_CSV[r.codigoCsv]}).`];
  const lineas = [
    `✅ ${r.fondos} fondo(s) pedidos a la SFC · con valores: ${r.conValores} · filas en el CSV: ${r.filas} · descartados (valor de unidad inválido): ${r.descartados}`,
    ...porLinea, ...fallos, ...sinCsv,
  ];
  const conAvisos = fallos.length > 0 || r.descartados > 0;
  return { lineas, codigoSalida: sinCsv.length > 0 ? SALIDA_FALLIDA : conAvisos ? SALIDA_CON_AVISOS : 0 };
}
