/**
 * Reporte de `npm run precios:actualizar` (SPEC-13): conteos por razón de omisión, especies con fallo
 * y código de salida. Solo conteos, códigos e ids internos: nunca precios ni nemotécnicos.
 * Sale con 3 si hubo fallos o barras sin guardar por falta de calendario (hay que actuar).
 */
import type { ResultadoActualizacion } from "./actualizar";

export const SALIDA_CON_AVISOS = 3;

export interface Reporte {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | typeof SALIDA_CON_AVISOS;
}

export function reporteActualizacion(r: ResultadoActualizacion): Reporte {
  const lineas = [
    `✅ ${r.especies} especie(s) · cierres nuevos: ${r.cierresNuevos} · revisados: ${r.cierresRevisados} · retirados (día no hábil o sin negociación): ${r.cierresRetirados} · verificados en el rango: ${r.verificados}`,
    `   omitidas · aún no definitivas (hora, hoy no hábil o fecha futura): ${r.omitidasPorHorario} · día no hábil: ${r.omitidasNoHabil} · sin negociación: ${r.omitidasSinNegociacion} · sin calendario: ${r.omitidasSinCalendario}`,
  ];
  const fallos = r.fallidas.length === 0 ? [] : [
    `⚠️  ${r.fallidas.length} especie(s) con fallo (Yahoo o guardado):`,
    ...r.fallidas.map((f) => `   · especie ${f.instrumentoId} · ${f.codigo}${f.detalle ? ` · ${f.detalle}` : ""} · barras guardadas: ${f.barrasGuardadas} · fallidas: ${f.barrasFallidas}`),
  ];
  const calendario = r.omitidasSinCalendario === 0 ? [] : [`⚠️  ${r.omitidasSinCalendario} barra(s) sin guardar porque calendario_bvc no cubre su año: hay que sembrar ese año.`];
  const avisos = [...fallos, ...calendario];
  return { lineas: [...lineas, ...avisos], codigoSalida: avisos.length > 0 ? SALIDA_CON_AVISOS : 0 };
}
