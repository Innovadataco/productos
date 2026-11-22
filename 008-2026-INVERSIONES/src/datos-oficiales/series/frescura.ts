/**
 * Frescura de una serie oficial (fase C, C5a): si su último valor vigente está al día frente a hoy. Pura y liviana (solo
 * el catálogo, las fechas del plan y consulta.ts), para la pantalla (C6a). Candado:
 * tests/unit/datos-oficiales/series-lectura-candados.test.ts.
 * - SIN_DATOS: la serie no tiene ningún vigente que ya haya empezado (ultimoValor dio null).
 * - ATRASADA: «a partir de» `umbralFrescuraDias` días (el del catálogo) entre el `hasta` del último y hoy.
 * - AL_DIA: menos que eso, incluso si su vigencia todavía corre (la TRM de un fin de semana).
 * `cubreHoy` dice si el último vale HOY (desde ≤ hoy ≤ hasta). Una serie AL_DIA cuyo último valor es de ayer (la TPM, que
 * BanRep publica con rezago) no es «la de hoy»: la pantalla muestra siempre la vigencia, y «hoy» solo con `cubreHoy`.
 * Así nunca se muestra un dato viejo como si fuera de hoy.
 * `hoy` es la fecha de negocio en Colombia a medianoche UTC (fechaEnBogota de src/precios/horario.ts), como en el CSV
 * de series. Nunca adivina: una entrada que no cuadra (otra serie, una cifra CALCULADA, una vigencia que todavía no
 * empieza, una vigencia al revés, una fecha que no es un día) es un error tipado. Para leer el último y su frescura con
 * un mismo hoy, `estadoSerie` de leer.ts.
 */
import { CATALOGO, type SerieCatalogo } from "../catalogo";
import { esFechaDeNegocio, MS_POR_DIA } from "../../plan/fechas";
import { ErrorLecturaSeries, type CifraOficial } from "./consulta";

export type EstadoFrescura = "AL_DIA" | "ATRASADA" | "SIN_DATOS";

export interface Frescura {
  readonly estado: EstadoFrescura;
  /** Días enteros del `hasta` del último a hoy (0 si su vigencia todavía corre); null sin datos. */
  readonly dias: number | null;
  /** El umbral de la serie en el catálogo. */
  readonly umbralDias: number;
  /** El último vale hoy (desde ≤ hoy ≤ hasta). */
  readonly cubreHoy: boolean;
}

function validarUltimo(codigo: string, ultimo: CifraOficial, hoy: Date): void {
  if (ultimo.serie !== codigo) throw new ErrorLecturaSeries("OTRA_SERIE");
  if (ultimo.origen !== "OFICIAL") throw new ErrorLecturaSeries("NO_ES_OFICIAL");
  if (!esFechaDeNegocio(ultimo.desde) || !esFechaDeNegocio(ultimo.hasta) || ultimo.desde.getTime() > ultimo.hasta.getTime()) {
    throw new ErrorLecturaSeries("FECHA_INVALIDA");
  }
  if (ultimo.desde.getTime() > hoy.getTime()) throw new ErrorLecturaSeries("VIGENCIA_FUTURA");
}

/** La frescura del último vigente de la serie `codigo` (el que da ultimoValor con el mismo hoy), o SIN_DATOS si es null. */
export function frescura(codigo: string, ultimo: CifraOficial | null, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Frescura {
  if (!esFechaDeNegocio(hoy)) throw new ErrorLecturaSeries("FECHA_INVALIDA");
  const serie = catalogo.find((s) => s.codigo === codigo);
  if (!serie) throw new ErrorLecturaSeries("SERIE_DESCONOCIDA");
  const umbralDias = serie.umbralFrescuraDias;
  if (ultimo === null) return Object.freeze({ estado: "SIN_DATOS" as const, dias: null, umbralDias, cubreHoy: false });
  validarUltimo(codigo, ultimo, hoy);
  const dias = Math.max(0, (hoy.getTime() - ultimo.hasta.getTime()) / MS_POR_DIA);
  return Object.freeze({ estado: dias >= umbralDias ? ("ATRASADA" as const) : ("AL_DIA" as const), dias, umbralDias, cubreHoy: ultimo.hasta.getTime() >= hoy.getTime() });
}
