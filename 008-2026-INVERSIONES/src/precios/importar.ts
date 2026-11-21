/**
 * `precios:importar` (vía B del runbook, producción sin red): guarda los cierres del CSV que exportó el Mac por el
 * MISMO camino que `precios:actualizar` (`guardarCierresDeEspecies`, en guardar.ts): mismas especies (acciones
 * activas con nemotécnico y lotes), versión con guarda, omisiones de SPEC-13 con el `ahora` de la importación y
 * re-verificación contra la certificación. Recibe el CSV ya leído y validado (csv-cierres.ts): todo o nada.
 * - Un nemotécnico del CSV sin esa especie no escribe nada y se informa por su primera línea (ESPECIE_NO_REGISTRADA).
 * - El exportador pide `<NEMO>.CL`: si la especie tiene registrado otro símbolo de Yahoo vigente, sus cierres no
 *   son los que usaría `precios:actualizar` y no se escriben (SIMBOLO_DISTINTO, como fallo de la especie).
 */
import type { PrismaClient } from "@prisma/client";
import { dondeEspecies, simboloDe } from "./actualizar";
import type { EspecieCsv, ResultadoLectura } from "./csv-cierres";
import { guardarCierresDeEspecies, type EspecieAGuardar, type ResultadoActualizacion } from "./guardar";
import type { ResultadoYahoo } from "./yahoo";

export type LecturaValida = Extract<ResultadoLectura, { readonly ok: true }>;

export interface EspecieSinGuardar {
  readonly linea: number;
  readonly codigo: "ESPECIE_NO_REGISTRADA";
}

export interface ResultadoImportacion {
  readonly filas: number;
  readonly especiesCsv: number;
  readonly sinEspecie: readonly EspecieSinGuardar[];
  readonly guardado: ResultadoActualizacion;
}

/** Los cierres del CSV, solo si el símbolo de Yahoo de la especie es el que pidió el exportador. */
async function delCsv(db: PrismaClient, instrumentoId: string, e: EspecieCsv, hasta: Date): Promise<ResultadoYahoo> {
  const simbolo = await simboloDe(db, instrumentoId, e.nemotecnico, hasta);
  return simbolo === `${e.nemotecnico}.CL` ? { ok: true, cierres: [...e.cierres] } : { ok: false, codigo: "SIMBOLO_DISTINTO" };
}

export async function importarPrecios(db: PrismaClient, csv: LecturaValida, opciones: { readonly ahora: Date }): Promise<ResultadoImportacion> {
  const nemos = csv.especies.map((e) => e.nemotecnico);
  const instrumentos = await db.instrumento.findMany({ where: { ...dondeEspecies(), nemotecnico: { in: nemos } }, select: { id: true, nemotecnico: true } });
  const idDe = new Map(instrumentos.map((i) => [i.nemotecnico, i.id]));
  const sinEspecie = csv.especies.filter((e) => !idDe.has(e.nemotecnico)).map((e) => ({ linea: e.primeraLinea, codigo: "ESPECIE_NO_REGISTRADA" as const }));
  const fuentes: EspecieAGuardar[] = csv.especies.flatMap((e) => {
    const instrumentoId = idDe.get(e.nemotecnico);
    return instrumentoId ? [{ instrumentoId, traer: () => delCsv(db, instrumentoId, e, csv.hasta) }] : [];
  });
  const guardado = await guardarCierresDeEspecies(db, fuentes, { desde: csv.desde, hasta: csv.hasta, ahora: opciones.ahora });
  return { filas: csv.filas, especiesCsv: csv.especies.length, sinEspecie, guardado };
}
