/**
 * La procedencia de los cierres del tablero (frente fecha-hora-datos): de una fila (su cierre) y de lo que suma varias
 * (el valor en acciones, el total, la composición y el neto de «Qué movió»), que se muestra por el cierre más viejo.
 * Puro y del lado del cliente: solo tipos y el módulo común.
 */
import { componer } from "@/app/_comun/fecha-dato/componer";
import type { Procedencia, ProcedenciaCompuesta } from "@/app/_comun/fecha-dato/tipos";
import type { FilaVista } from "./tipos";

type CierreVista = NonNullable<FilaVista["cierre"]>;

export const procedenciaDeCierre = (c: CierreVista): Procedencia => ({ dia: c.fecha, traidoEn: c.traidoEn, fuente: c.fuente, habilesAtras: c.habilesAtras });

/** Las filas con cierre, compuestas por su cierre más viejo; null si ninguna tiene cierre. */
export const procedenciaDeFilas = (filas: readonly FilaVista[]): ProcedenciaCompuesta | null =>
  componer(filas.flatMap((f) => (f.cierre ? [procedenciaDeCierre(f.cierre)] : [])));
