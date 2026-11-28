/**
 * Un ciclo de precios intradía: para cada especie con posición o con regla en el plan vigente, una petición a Yahoo con las
 * barras de 1 minuto de hoy, guardadas sin duplicar (`guardar.ts`). Lo corre el servicio de precios cada minuto durante la
 * rueda, como un proceso hijo (`scripts/actualizar-intradia.ts`).
 * - Una petición por especie (el endpoint de barras es de un símbolo), una tras otra y espaciadas por `pausaMs`: nunca en
 *   paralelo. Con N especies, N peticiones por ciclo.
 * - Bloqueo (código 7): algún 401, 403, 429 o 999 de Yahoo corta el ciclo en la primera petición (no se insiste con las demás
 *   especies); o TODAS las peticiones fallaron por red, por tiempo o por un 5xx (Yahoo cae o no responde). Las barras ya guardadas quedan.
 * - Fallo de datos (código 8): TODAS las peticiones fallaron, pero no por bloqueo (404, sin datos, formato raro, moneda, o una
 *   mezcla): el símbolo o la respuesta está mal, no Yahoo. El servicio espera como con un fallo, pero no cuenta para la racha de
 *   bloqueos ni dispara el aviso del vigía. Un 404 de una especie suelta tampoco es un bloqueo: código 3.
 * - Otro fallo de una especie (sin datos, respuesta rara, red) queda en `fallidas` con su código y el id interno de la
 *   especie, nunca su nemotécnico ni cifras; las demás siguen.
 * - Topes fijos (`tope.ts`): a lo sumo 20 especies por ciclo y 9 000 peticiones por día (aproximado: el contador se reinicia con el
 *   servicio); al llegar, sale un aviso (`avisos`). Con el tope del día alcanzado (o un contador ilegible) no pide nada y sale con 5.
 *   Si no se puede guardar el contador, el resultado del ciclo no se tapa: queda un aviso.
 * - Día no hábil (fin de semana o festivo de calendario_bvc): no pide nada y sale con 4. Un año que calendario_bvc no cubre se
 *   trata como hábil si es entre semana y se avisa en `sinCalendario`; pero si pasadas las 10:30 (Yahoo entrega con ~20 min de
 *   retraso, así que antes de las 9:50 no hay barras de hoy) ninguna especie trae una sola barra de hoy y ninguna falló, sale con
 *   6 («sin barras de hoy y sin calendario del año: posible día no hábil»). El servicio decide tras DOS ciclos seguidos y reintenta
 *   cada 30 min: este ciclo no congela el día.
 * Salida: 0 bien · 3 alguna especie falló · 4 día no hábil · 5 tope diario de peticiones · 6 sin barras sin calendario · 7 bloqueo ·
 * 8 fallo de datos. Un error de la base  * se propaga (el CLI sale con 1).
 */
import type { PrismaClient } from "@prisma/client";
import { simboloDe } from "../actualizar";
import { leerCalendarioBvc } from "../guardar";
import { esDiaHabil, fechaEnBogota, minutosDelDiaEnBogota } from "../horario";
import type { Buscar } from "../yahoo";
import { especiesIntradia, type EspecieIntradia } from "./especies";
import { guardarBarras } from "./guardar";
import { TOPE_ESPECIES_CICLO, TOPE_PETICIONES_DIA, type ContadorDia } from "./tope";
import { obtenerBarrasIntradia, type BarraIntradia } from "./yahoo";

export interface FalloIntradia {
  readonly instrumentoId: string;
  readonly codigo: string;
}

export interface ResultadoCicloIntradia {
  readonly codigo: 0 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly especies: number;
  readonly peticiones: number;
  readonly barrasNuevas: number;
  readonly fallidas: readonly FalloIntradia[];
  readonly sinCalendario: boolean;
  /** Avisos del ciclo (topes, día tratado como no hábil): sin nemotécnicos ni cifras. */
  readonly avisos: readonly string[];
}

export interface OpcionesCicloIntradia {
  readonly buscar: Buscar;
  readonly ahora: Date;
  readonly urlYahoo: string;
  /** Espera entre una petición y la siguiente (0: sin espera). */
  readonly pausaMs: number;
  /** La espera (inyectable en las pruebas). */
  readonly dormir?: (ms: number) => Promise<void>;
  /** Desde qué especie se empieza (módulo el número de especies): rotarlo evita que, si el ciclo se corta por el plazo, las últimas queden siempre sin precios. */
  readonly arranque?: number;
  /** Tope de especies por ciclo (por omisión, 20). */
  readonly topeEspecies?: number;
  /** Tope de peticiones por día de Colombia (por omisión, 9 000). */
  readonly topePeticionesDia?: number;
  /** Dónde se cuentan las peticiones del día; sin él, no hay tope diario. */
  readonly contadorDia?: ContadorDia;
  /** Las especies a pedir (inyectable en las pruebas); por omisión, las del plan y las de posición. */
  readonly especies?: (hoy: Date) => Promise<readonly EspecieIntradia[]>;
  /** Guarda las barras de una especie (inyectable en las pruebas); por omisión, `guardarBarras`. */
  readonly guardar?: (instrumentoId: string, barras: readonly BarraIntradia[], conRetraso: boolean) => Promise<number>;
}

/** Los códigos con que Yahoo bloquea: pedir de más (429), acceso denegado (401, 403) o su bloqueo propio (999). Un 404 no lo es. */
const BLOQUEO: ReadonlySet<string> = new Set(["YAHOO_HTTP_429", "YAHOO_HTTP_401", "YAHOO_HTTP_403", "YAHOO_HTTP_999"]);
/** Fallos de transporte: la red, el tiempo o un 5xx. Si TODAS las peticiones fallan así, Yahoo cae o no responde: cuenta como bloqueo. */
const esTransporte = (codigo: string): boolean => codigo === "YAHOO_RED" || /^YAHOO_HTTP_5\d\d$/.test(codigo);
/** Antes de esta hora de Colombia (10:30) es normal no tener barras de hoy: Yahoo entrega con ~20 min de retraso y la rueda abre a las 9:30. */
const MINUTO_SIN_BARRAS_DE_HOY = 10 * 60 + 30;
const dormirReal = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

const vacio = (codigo: ResultadoCicloIntradia["codigo"], sinCalendario: boolean, avisos: readonly string[] = []): ResultadoCicloIntradia => ({
  codigo, especies: 0, peticiones: 0, barrasNuevas: 0, fallidas: [], sinCalendario, avisos,
});

export async function correrCicloIntradia(db: PrismaClient, opciones: OpcionesCicloIntradia): Promise<ResultadoCicloIntradia> {
  const dormir = opciones.dormir ?? dormirReal;
  const hoy = fechaEnBogota(opciones.ahora);
  const calendario = await leerCalendarioBvc(db, hoy, hoy);
  const sinCalendario = !calendario.aniosCubiertos.has(hoy.getUTCFullYear());
  if (!esDiaHabil(hoy, calendario.noHabiles)) return vacio(4, sinCalendario);

  const dia = hoy.toISOString().slice(0, 10);
  const topeEspecies = opciones.topeEspecies ?? TOPE_ESPECIES_CICLO;
  const topeDia = opciones.topePeticionesDia ?? TOPE_PETICIONES_DIA;
  const usadas = opciones.contadorDia ? await opciones.contadorDia.leer(dia) : 0;
  const avisos: string[] = [];
  if (usadas >= topeDia) return vacio(5, sinCalendario, [`tope de peticiones por día (${topeDia}) alcanzado: hoy no se piden más precios`]);

  const todas = await (opciones.especies ? opciones.especies(hoy) : especiesIntradia(db, hoy));
  const desde = todas.length === 0 ? 0 : Math.abs(Math.trunc(opciones.arranque ?? 0)) % todas.length;
  const rotadas = [...todas.slice(desde), ...todas.slice(0, desde)];
  const cupo = Math.min(topeEspecies, topeDia - usadas);
  const especies = rotadas.slice(0, cupo);
  if (rotadas.length > cupo) {
    avisos.push(
      cupo < topeEspecies
        ? `tope de peticiones por día (${topeDia}): este ciclo pide ${cupo} de ${rotadas.length} especies`
        : `tope de especies por ciclo (${topeEspecies}): este ciclo pide ${cupo} de ${rotadas.length} especies`,
    );
  }
  const guardar = opciones.guardar ?? ((id: string, barras: readonly BarraIntradia[], conRetraso: boolean) => guardarBarras(db, id, barras, conRetraso, opciones.ahora));
  const fallidas: FalloIntradia[] = [];
  let peticiones = 0;
  let barrasNuevas = 0;
  let barrasDeHoy = 0;
  let bloqueado = false;
  let falloDeBase: unknown = null;
  try {
    for (const [i, especie] of especies.entries()) {
      if (i > 0 && opciones.pausaMs > 0) await dormir(opciones.pausaMs);
      const simbolo = await simboloDe(db, especie.id, especie.nemotecnico, hoy);
      const r = await obtenerBarrasIntradia(simbolo, { baseUrl: opciones.urlYahoo, buscar: opciones.buscar, ahora: opciones.ahora });
      peticiones += 1;
      if (!r.ok) {
        if (BLOQUEO.has(r.codigo)) {
          bloqueado = true;
          break;
        }
        fallidas.push({ instrumentoId: especie.id, codigo: r.codigo });
        continue;
      }
      barrasDeHoy += r.barras.length;
      barrasNuevas += await guardar(especie.id, r.barras, r.conRetraso);
    }
  } catch (error) {
    falloDeBase = error ?? new Error("fallo");
  }
  // El contador del día se guarda pase lo que pase, pero un fallo al guardarlo no tapa el resultado ni el error real.
  if (opciones.contadorDia && peticiones > 0) {
    try {
      await opciones.contadorDia.guardar(dia, usadas + peticiones);
    } catch {
      avisos.push("no se pudo guardar el contador de peticiones del día: el tope diario puede quedar corto");
    }
  }
  if (falloDeBase !== null) throw falloDeBase;
  const resultado = (codigo: ResultadoCicloIntradia["codigo"]): ResultadoCicloIntradia => ({ codigo, especies: especies.length, peticiones, barrasNuevas, fallidas, sinCalendario, avisos });
  // Bloqueo: un código de bloqueo, o TODAS las peticiones fallaron por transporte (red, tiempo, 5xx).
  const todasFallaron = peticiones > 0 && fallidas.length === peticiones;
  if (bloqueado || (todasFallaron && fallidas.every((f) => esTransporte(f.codigo)))) return resultado(7);
  // Fallo de datos: todas fallaron, pero no por bloqueo (404, sin datos, formato raro o una mezcla): no cuenta como bloqueo.
  if (todasFallaron) return resultado(8);
  const sinBarras = sinCalendario && peticiones > 0 && fallidas.length === 0 && barrasDeHoy === 0 && minutosDelDiaEnBogota(opciones.ahora) >= MINUTO_SIN_BARRAS_DE_HOY;
  if (sinBarras) {
    avisos.push("sin barras de hoy y sin calendario del año: posible día no hábil");
    return resultado(6);
  }
  return resultado(fallidas.length > 0 ? 3 : 0);
}
