/**
 * Las entradas INVENTADAS de los 42 casos del arnés: 17 DIARIO (los dos últimos, grandes: diez especies), 15 REGLAS y 10 ESCENARIOS, desde una semilla fija
 * (`crearPrng` del motor de proyecciones). Cada tipo tiene su propio azar derivado de la semilla, así agregar un caso de
 * un tipo no cambia los de los otros. Solo para el CI y las métricas de robustez: lo que ve Jelk sale de su portafolio
 * (el export por la vía B, `--paquetes`). Nada sale de una base ni de datos reales.
 */
import type { TipoResumen } from "../contrato";
import type { EntradaArmadoDiario, EntradaArmadoEscenarios, EntradaArmadoReglas } from "../hechos";
import { crearPrng } from "../../proyecciones/prng";
import { entradaDiarioInventada } from "./inventados/diario.ficticio";
import { entradaEscenariosInventada } from "./inventados/escenarios.ficticio";
import { entradaReglasInventada } from "./inventados/reglas.ficticio";

export const SEMILLA_INVENTADOS = 37_911;
export const CANTIDAD_INVENTADOS: Readonly<Record<TipoResumen, number>> = Object.freeze({ DIARIO: 17, REGLAS: 15, ESCENARIOS: 10 });

/** Desplazamiento de la semilla por tipo (números primos, sin significado). */
const DESPLAZAMIENTO: Readonly<Record<TipoResumen, number>> = Object.freeze({ DIARIO: 0, REGLAS: 7919, ESCENARIOS: 104_729 });
const MAX_SEMILLA = 4_294_967_295;

export interface EntradasInventadas {
  readonly diario: readonly EntradaArmadoDiario[];
  readonly reglas: readonly EntradaArmadoReglas[];
  readonly escenarios: readonly EntradaArmadoEscenarios[];
}

const semillaDe = (semilla: number, tipo: TipoResumen): number => (semilla + DESPLAZAMIENTO[tipo]) % (MAX_SEMILLA + 1);
const indices = (tipo: TipoResumen): readonly number[] => Array.from({ length: CANTIDAD_INVENTADOS[tipo] }, (_, i) => i);

/** Las entradas de los tres tipos. Una semilla fuera de 0 a 2^32 − 1 lanza RangeError (la revisa `crearPrng`). */
export function entradasInventadas(semilla: number): EntradasInventadas {
  if (!Number.isInteger(semilla) || semilla < 0 || semilla > MAX_SEMILLA) throw new RangeError("La semilla debe ser un entero de 0 a 2^32 − 1.");
  const azarDiario = crearPrng(semillaDe(semilla, "DIARIO"));
  const azarReglas = crearPrng(semillaDe(semilla, "REGLAS"));
  const azarEscenarios = crearPrng(semillaDe(semilla, "ESCENARIOS"));
  return Object.freeze({
    diario: Object.freeze(indices("DIARIO").map((i) => entradaDiarioInventada(azarDiario, i))),
    reglas: Object.freeze(indices("REGLAS").map((i) => entradaReglasInventada(azarReglas, i))),
    escenarios: Object.freeze(indices("ESCENARIOS").map((i) => entradaEscenariosInventada(azarEscenarios, i))),
  });
}
