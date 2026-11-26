/**
 * Los casos del arnés (E7): los 42 inventados (armados con los armadores reales de E1b desde las entradas con semilla
 * fija), su hash (para que el informe compare corridas de los MISMOS casos) y un recorte balanceado por tipo.
 */
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { jsonCanonico, sha256Hex } from "../hash";
import { armarDiario, armarEscenarios, armarReglas } from "../hechos";
import { entradasInventadas, SEMILLA_INVENTADOS } from "./inventados.ficticio";
import type { CasoEvaluacion } from "./tipos";

const ANCHO_NUMERO = 2;

const id = (tipo: TipoResumen, i: number): string => `${tipo}-${String(i + 1).padStart(ANCHO_NUMERO, "0")}`;

/** Los 42 casos inventados de la semilla: DIARIO-01…17, REGLAS-01…15 y ESCENARIOS-01…10. Congelados. */
export function casosInventados(semilla: number = SEMILLA_INVENTADOS): readonly CasoEvaluacion[] {
  const e = entradasInventadas(semilla);
  const casos: CasoEvaluacion[] = [
    ...e.diario.map((entrada, i) => ({ id: id("DIARIO", i), tipo: "DIARIO" as const, paquete: armarDiario(entrada) })),
    ...e.reglas.map((entrada, i) => ({ id: id("REGLAS", i), tipo: "REGLAS" as const, paquete: armarReglas(entrada) })),
    ...e.escenarios.map((entrada, i) => ({ id: id("ESCENARIOS", i), tipo: "ESCENARIOS" as const, paquete: armarEscenarios(entrada) })),
  ];
  return Object.freeze(casos.map((c) => Object.freeze(c)));
}

/** sha256 de los ids y los hashes de los paquetes, en orden. */
export function hashDeCasos(casos: readonly CasoEvaluacion[]): string {
  return sha256Hex(jsonCanonico(casos.map((c) => [c.id, c.paquete.hash])));
}

/**
 * Hasta `maximo` casos, intercalados por tipo (el primero de cada tipo, después el segundo…), en el orden de los tipos
 * del contrato. Un máximo que no es un entero positivo lanza RangeError.
 */
export function limitarCasos(casos: readonly CasoEvaluacion[], maximo: number): readonly CasoEvaluacion[] {
  if (!Number.isInteger(maximo) || maximo < 1) throw new RangeError("El máximo de casos debe ser un entero positivo.");
  const porTipo = TIPOS_RESUMEN.map((tipo) => casos.filter((c) => c.tipo === tipo));
  const largo = Math.max(0, ...porTipo.map((l) => l.length));
  const intercalados = Array.from({ length: largo }, (_, i) => porTipo.flatMap((l) => (i < l.length ? [l[i] as CasoEvaluacion] : []))).flat();
  return Object.freeze(intercalados.slice(0, maximo));
}

/**
 * Los casos de los ids dados, en el orden de la lista completa (no en el de los ids), congelados; null si alguno no existe
 * (el arnés lo cierra en fallo sin repetir el id). Sin ids, ninguno.
 */
export function elegirCasos(casos: readonly CasoEvaluacion[], ids: readonly string[]): readonly CasoEvaluacion[] | null {
  const pedidos = new Set(ids);
  if (ids.some((id) => !casos.some((c) => c.id === id))) return null;
  return Object.freeze(casos.filter((c) => pedidos.has(c.id)));
}
