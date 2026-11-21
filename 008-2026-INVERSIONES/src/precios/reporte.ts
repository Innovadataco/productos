/**
 * Reportes de `npm run precios:actualizar`, `precios:depurar` (SPEC-13), `precios:importar` y `precios:exportar` (la
 * vía B): conteos por razón, especies con fallo y código de salida. Solo conteos, códigos, números de línea, ids
 * internos y el nombre de la base: nunca precios ni nemotécnicos. Salen con 3 si hay algo que atender (fallos,
 * falta de calendario, especies que quedaron fuera…).
 */
import { MAX_ERRORES_CONTADOS } from "./csv-cierres";
import type { ResultadoDepuracion } from "./depurar";
import type { ResultadoExportacion } from "./exportar";
import type { ResultadoActualizacion } from "./guardar";
import type { ResultadoImportacion } from "./importar";

export const SALIDA_CON_AVISOS = 3;
/** Sin resultado que entregar (p. ej. el exportador no pudo escribir ningún CSV). */
export const SALIDA_FALLIDA = 1;

export interface Reporte {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | typeof SALIDA_FALLIDA | typeof SALIDA_CON_AVISOS;
}

export function reporteActualizacion(r: ResultadoActualizacion): Reporte {
  const lineas = [
    `✅ ${r.especies} especie(s) · cierres nuevos: ${r.cierresNuevos} · revisados: ${r.cierresRevisados} · re-verificados (mismo cierre, cambió la certificación del día): ${r.cierresReverificados} · retirados (día no hábil o sin negociación): ${r.cierresRetirados} · verificados en el rango: ${r.verificados}`,
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

function avisosDepuracion(r: ResultadoDepuracion): string[] {
  return [
    ...(r.fallidas.length === 0 ? [] : [
      `⚠️  ${r.fallidas.length} especie(s) con fallo (si es de Yahoo, solo se tocaron sus días no hábiles; si es GUARDADO_ERROR, nada de esa especie):`,
      ...r.fallidas.map((f) => `   · especie ${f.instrumentoId} · ${f.codigo}${f.detalle ? ` · ${f.detalle}` : ""}`),
    ]),
    ...(r.sinCalendario === 0 ? [] : [`⚠️  ${r.sinCalendario} cierre(s) sin tocar porque calendario_bvc no cubre su año: hay que sembrar ese año.`]),
    ...(r.diagnostico.sinNegociacionConCierreDistinto === 0 ? [] : [`⚠️  ${r.diagnostico.sinNegociacionConCierreDistinto} barra(s) con volumen 0 y un cierre distinto del anterior: contradicen «volumen 0 = sin negociación». Revíselo antes de --aplicar.`]),
    ...(r.cambiadosPorOtro === 0 ? [] : [`⚠️  ${r.cambiadosPorOtro} cierre(s) cambiados por otra corrida durante la depuración: no se pisaron; vuelva a correr.`]),
  ];
}

function siguientePaso(r: ResultadoDepuracion): string[] {
  if (!r.aplicado && r.aRetirarNoHabil + r.aRetirarSinNegociacion > 0) {
    return [`Siguiente: con el arreglo desplegado donde corran las cargas, repita con --aplicar --base ${r.base} y después otra vez (debe dar 0 retirados).`];
  }
  return r.aplicado && r.retirados > 0 ? ["Siguiente: corra el mismo comando otra vez (debe dar 0 retirados)."] : [];
}

export function reporteDepuracion(r: ResultadoDepuracion): Reporte {
  const avisos = avisosDepuracion(r);
  const lineas = [
    `Base: ${r.base} · modo: ${r.aplicado ? "APLICAR (retira)" : "ENSAYO (no escribe)"} · ${r.especies} especie(s) · cierres vigentes de Yahoo revisados: ${r.vigentesRevisados}`,
    `   sobran · día no hábil: ${r.aRetirarNoHabil} · sin negociación: ${r.aRetirarSinNegociacion} · retirados ahora: ${r.retirados} · cambiados por otra corrida (no se pisaron): ${r.cambiadosPorOtro}`,
    `   sin tocar · año sin calendario: ${r.sinCalendario} · aún no definitivos: ${r.aunNoDefinitivos}`,
    `   diagnóstico de Yahoo · barras: ${r.diagnostico.barras} · volumen 0 con cierre distinto del anterior: ${r.diagnostico.sinNegociacionConCierreDistinto} · días hábiles con volumen null: ${r.diagnostico.habilesConVolumenNull}`,
  ];
  return { lineas: [...lineas, ...avisos, ...siguientePaso(r)], codigoSalida: avisos.length > 0 ? SALIDA_CON_AVISOS : 0 };
}

/** `precios:importar`: una línea del CSV y, después, exactamente el reporte de `precios:actualizar`, más las especies sin guardar. */
export function reporteImportacion(r: ResultadoImportacion): Reporte {
  const base = reporteActualizacion(r.guardado);
  const sinEspecie = r.sinEspecie.length === 0 ? [] : [
    `⚠️  ${r.sinEspecie.length} especie(s) del CSV sin guardar (no hay una acción activa con lotes y ese nemotécnico):`,
    ...r.sinEspecie.map((s) => `   · línea ${s.linea} · ${s.codigo}`),
  ];
  const conAvisos = base.codigoSalida !== 0 || sinEspecie.length > 0;
  return { lineas: [`📄 CSV de cierres · filas: ${r.filas} · especies: ${r.especiesCsv}`, ...base.lineas, ...sinEspecie], codigoSalida: conAvisos ? SALIDA_CON_AVISOS : 0 };
}

/** Un CSV (o una lista) rechazado: cuántos errores, los listados con línea y código, y cuántos quedaron sin listar. */
export function reporteErroresCsv(r: { readonly errores: readonly { readonly linea: number; readonly codigo: string }[]; readonly totalErrores: number }, que = "CSV_INVALIDO"): string[] {
  const resto = r.totalErrores - r.errores.length;
  const cortado = r.totalErrores >= MAX_ERRORES_CONTADOS;
  const mas = cortado ? `   … y al menos ${resto} más (se dejó de leer en ${MAX_ERRORES_CONTADOS})` : `   … y ${resto} más`;
  return [
    `❌ ${que} · ${r.totalErrores} error(es); no se guardó nada:`,
    ...r.errores.map((e) => `   · línea ${e.linea} · ${e.codigo}`),
    ...(resto > 0 ? [mas] : []),
  ];
}

const SIN_CSV: Readonly<Record<NonNullable<ResultadoExportacion["codigoCsv"]>, string>> = {
  SIN_FILAS: "no hay cierres que escribir",
  CSV_DEMASIADO_GRANDE: "pida un rango más corto o menos especies",
  FILA_INVALIDA: "una fila no pasaría la validación del importador",
};

/** `precios:exportar` (a stderr; el CSV va a stdout): conteos, especies que quedaron fuera por su línea de la lista. */
export function reporteExportacion(r: ResultadoExportacion): Reporte {
  const fallos = r.fallidas.length === 0 ? [] : [`⚠️  ${r.fallidas.length} especie(s) sin cierres en el CSV:`, ...r.fallidas.map((f) => `   · línea ${f.linea} de la lista · ${f.codigo}`)];
  const sinCsv = r.codigoCsv === null ? [] : [`❌ ${r.codigoCsv} · no se escribió el CSV (${SIN_CSV[r.codigoCsv]}).`];
  const lineas = [
    `✅ ${r.especies} especie(s) pedidas a Yahoo · con cierres: ${r.conCierres} · filas en el CSV: ${r.filas} · descartadas (aún no definitivas o fuera del rango): ${r.descartadas}`,
    ...fallos, ...sinCsv,
  ];
  return { lineas, codigoSalida: sinCsv.length > 0 ? SALIDA_FALLIDA : fallos.length > 0 ? SALIDA_CON_AVISOS : 0 };
}
