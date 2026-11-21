/**
 * Reportes de `npm run precios:actualizar` y `npm run precios:depurar` (SPEC-13): conteos por razón,
 * especies con fallo y código de salida. Solo conteos, códigos, ids internos y el nombre de la base:
 * nunca precios ni nemotécnicos. Salen con 3 si hay algo que atender (fallos, falta de calendario…).
 */
import type { ResultadoActualizacion } from "./actualizar";
import type { ResultadoDepuracion } from "./depurar";

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

function avisosDepuracion(r: ResultadoDepuracion): string[] {
  return [
    ...(r.fallidas.length === 0 ? [] : [`⚠️  ${r.fallidas.length} especie(s) sin respuesta de Yahoo (sus días hábiles no se tocaron):`, ...r.fallidas.map((f) => `   · especie ${f.instrumentoId} · ${f.codigo}`)]),
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
