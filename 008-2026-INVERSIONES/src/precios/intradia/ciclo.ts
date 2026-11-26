/**
 * Un ciclo de precios intradía: para cada especie con posición o con regla en el plan vigente, una petición a Yahoo con las
 * barras de 1 minuto de hoy, guardadas sin duplicar (`guardar.ts`). Lo corre el servicio de precios cada minuto durante la
 * rueda, como un proceso hijo (`scripts/actualizar-intradia.ts`).
 * - Una petición por especie (el endpoint de barras es de un símbolo), una tras otra y espaciadas por `pausaMs`: nunca en
 *   paralelo. Con N especies, N peticiones por ciclo.
 * - Un 429 de Yahoo detiene el ciclo en seco (no se insiste con las demás especies) y sale con 7: el servicio espera más
 *   (exponencialmente) antes del siguiente. Las barras ya guardadas quedan.
 * - Otro fallo de una especie (sin datos, respuesta rara, red) queda en `fallidas` con su código y el id interno de la
 *   especie, nunca su nemotécnico ni cifras; las demás siguen.
 * - Día no hábil (fin de semana o festivo de calendario_bvc): no pide nada y sale con 4. Un año que calendario_bvc no cubre se
 *   trata como hábil si es entre semana (Yahoo no trae barras de un día sin negociación) y se avisa en `sinCalendario`.
 * Salida: 0 bien · 3 alguna especie falló · 4 día no hábil · 7 Yahoo limitó (429). Un error de la base se propaga (el CLI sale con 1).
 */
import type { PrismaClient } from "@prisma/client";
import { simboloDe } from "../actualizar";
import { leerCalendarioBvc } from "../guardar";
import { esDiaHabil, fechaEnBogota } from "../horario";
import type { Buscar } from "../yahoo";
import { especiesIntradia } from "./especies";
import { guardarBarras } from "./guardar";
import { obtenerBarrasIntradia } from "./yahoo";

export interface FalloIntradia {
  readonly instrumentoId: string;
  readonly codigo: string;
}

export interface ResultadoCicloIntradia {
  readonly codigo: 0 | 3 | 4 | 7;
  readonly especies: number;
  readonly peticiones: number;
  readonly barrasNuevas: number;
  readonly fallidas: readonly FalloIntradia[];
  readonly sinCalendario: boolean;
}

export interface OpcionesCicloIntradia {
  readonly buscar: Buscar;
  readonly ahora: Date;
  readonly urlYahoo: string;
  /** Espera entre una petición y la siguiente (0: sin espera). */
  readonly pausaMs: number;
  /** La espera (inyectable en las pruebas). */
  readonly dormir?: (ms: number) => Promise<void>;
}

/** El código con que Yahoo avisa que se pidió de más. */
const LIMITADO = "YAHOO_HTTP_429";
const dormirReal = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

export async function correrCicloIntradia(db: PrismaClient, opciones: OpcionesCicloIntradia): Promise<ResultadoCicloIntradia> {
  const dormir = opciones.dormir ?? dormirReal;
  const hoy = fechaEnBogota(opciones.ahora);
  const calendario = await leerCalendarioBvc(db, hoy, hoy);
  const sinCalendario = !calendario.aniosCubiertos.has(hoy.getUTCFullYear());
  if (!esDiaHabil(hoy, calendario.noHabiles)) return { codigo: 4, especies: 0, peticiones: 0, barrasNuevas: 0, fallidas: [], sinCalendario };

  const especies = await especiesIntradia(db, hoy);
  const fallidas: FalloIntradia[] = [];
  let peticiones = 0;
  let barrasNuevas = 0;
  let limitado = false;
  for (const [i, especie] of especies.entries()) {
    if (i > 0 && opciones.pausaMs > 0) await dormir(opciones.pausaMs);
    const simbolo = await simboloDe(db, especie.id, especie.nemotecnico, hoy);
    const r = await obtenerBarrasIntradia(simbolo, { baseUrl: opciones.urlYahoo, buscar: opciones.buscar, ahora: opciones.ahora });
    peticiones += 1;
    if (!r.ok) {
      if (r.codigo === LIMITADO) {
        limitado = true;
        break;
      }
      fallidas.push({ instrumentoId: especie.id, codigo: r.codigo });
      continue;
    }
    barrasNuevas += await guardarBarras(db, especie.id, r.barras, r.conRetraso);
  }
  const codigo = limitado ? 7 : fallidas.length > 0 ? 3 : 0;
  return { codigo, especies: especies.length, peticiones, barrasNuevas, fallidas, sinCalendario };
}
