/**
 * Una corrida del servicio de precios: precios (cierres de Yahoo) y LUEGO fondo (valor de unidad de la SFC), de a uno
 * y cada uno con su plazo. Fondo corre aunque precios falle: son fuentes independientes. Sin reintentos: si algo
 * falla, la próxima es la del siguiente día hábil (los CLI traen los últimos 10 días).
 * Resultado: el peor de los dos. OK (los dos 0) · AVISO (3 en alguno, que es «dato atrasado, sin fondos o especie sin
 * guardar», y ninguno peor) · FALLO (cualquier otro código, plazo vencido, señal o no arrancó).
 */
import { PLAZO_TAREA_MS, type Corredor, type ResultadoTarea, type Tarea } from "./tareas";

export type Resultado = "OK" | "AVISO" | "FALLO";

export interface ResultadoCorrida {
  readonly resultado: Resultado;
  readonly tareas: readonly ResultadoTarea[];
  /** Para --ahora: 0 bien · 3 aviso · 1 fallo (los mismos de los CLI). */
  readonly codigoSalida: 0 | 1 | 3;
}

const TAREAS: readonly Tarea[] = ["precios", "fondo"];
const SALIDA_DE: Readonly<Record<Resultado, 0 | 1 | 3>> = { OK: 0, AVISO: 3, FALLO: 1 };

export function resultadoDe(tareas: readonly ResultadoTarea[]): Resultado {
  if (tareas.every((t) => t.codigo === "0")) return "OK";
  return tareas.every((t) => t.codigo === "0" || t.codigo === "3") ? "AVISO" : "FALLO";
}

export async function hacerCorrida(corredor: Corredor, desde: string | null, plazoMs: number = PLAZO_TAREA_MS): Promise<ResultadoCorrida> {
  const args = desde === null ? [] : ["--desde", desde];
  const tareas: ResultadoTarea[] = [];
  for (const tarea of TAREAS) tareas.push(await corredor.correr(tarea, args, plazoMs));
  const resultado = resultadoDe(tareas);
  return { resultado, tareas, codigoSalida: SALIDA_DE[resultado] };
}
