/**
 * Cifras oficiales para la lectura (fase C, C5a): el tipo que entregan leer.ts (de la base) y variacionIndice (calculada
 * aquí), y los errores de la lectura. Puro y liviano: solo importa las fechas del plan (ni Prisma ni csv-series.ts, que
 * arrastra el cliente HTTP por precios/yahoo), así la pantalla (C6a) lo podrá usar desde src/app. Candado:
 * tests/unit/datos-oficiales/series-lectura-candados.test.ts.
 * - OFICIAL: lo que publicó la fuente, tal como lo guarda valor_serie_oficial, de una vigencia VIGENTE (nunca una
 *   retirada: leer.ts filtra reemplazadoEn nulo).
 * - CALCULADA: lo que 008 calcula con cifras oficiales (hoy, la variación de un índice). Nunca se atribuye a la fuente:
 *   su unidad lo dice («calculada por 008»).
 * Los valores nunca pasan por Number: se validan como texto decimal y se calculan con BigInt. Los errores llevan solo
 * su código (ni valores ni fechas).
 */
import { esFechaDeNegocio } from "../../plan/fechas";

export type OrigenCifra = "OFICIAL" | "CALCULADA";

export interface CifraOficial {
  /** Código del catálogo (src/datos-oficiales/catalogo.ts). */
  readonly serie: string;
  /**
   * OFICIAL: decimal canónico positivo (sin signo, ceros sobrantes ni exponente), como lo guarda la base (esValorOficial).
   * CALCULADA: con «-» si es negativa y exactamente DECIMALES_VARIACION decimales.
   */
  readonly valor: string;
  /** La del catálogo; en una CALCULADA, UNIDAD_VARIACION. */
  readonly unidad: string;
  /**
   * OFICIAL: la vigencia publicada, cerrada en los dos extremos y a medianoche UTC: el valor vale del desde al hasta.
   * CALCULADA (variación): el desde del periodo base y el hasta del periodo final.
   */
  readonly desde: Date;
  readonly hasta: Date;
  /** La fuente con su dataset (sfc:…, banrep:… o dane:…). En una CALCULADA, la de la cifra final. */
  readonly fuente: string;
  /** Cuándo entró a la base. En una CALCULADA, el más reciente de los dos. */
  readonly traidoEn: Date;
  readonly origen: OrigenCifra;
}

export type CodigoErrorSeries =
  | "SERIE_DESCONOCIDA" | "FECHA_INVALIDA" | "RANGO_INVALIDO" | "RANGO_DEMASIADO_LARGO" | "DEMASIADAS_FILAS" | "VALOR_INVALIDO"
  | "NO_ES_OFICIAL" | "SERIES_DISTINTAS" | "NO_ES_INDICE" | "BASE_NO_ANTERIOR" | "OTRA_SERIE" | "VIGENCIA_FUTURA";

/** Un error de la lectura o del cálculo: su mensaje es solo el código. */
export class ErrorLecturaSeries extends Error {
  readonly codigo: CodigoErrorSeries;
  constructor(codigo: CodigoErrorSeries) {
    super(codigo);
    this.name = "ErrorLecturaSeries";
    this.codigo = codigo;
  }
}

/**
 * Las series del catálogo que son un índice: solo con ellas el cambio es un % de variación (el de una tasa, como la TPM,
 * se mide en puntos). Candado: están en el catálogo y son mensuales.
 */
export const SERIES_INDICE: readonly string[] = Object.freeze(["IPC_INDICE"]);
/**
 * La unidad de una variación calculada. Parte de índices de 2 decimales: puede diferir en 0,01 de la variación que
 * publica el DANE en su otro anexo (POR VERIFICAR); por eso nunca se le atribuye.
 */
export const UNIDAD_VARIACION = "% de variación (calculada por Inversiones)";
export const DECIMALES_VARIACION = 2;

/** Lo que cabe en DECIMAL(20,8), en forma canónica: hasta 12 enteros y 8 decimales, sin ceros sobrantes. */
const VALOR_OFICIAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{0,7}[1-9])?$/;
const DIEZ = 10n;
const CIEN = 100n;

/** ¿Es un valor como los que guarda la base (DECIMAL(20,8) y > 0) en su forma canónica? */
export function esValorOficial(texto: string): boolean {
  return VALOR_OFICIAL.test(texto) && texto !== "0";
}

/**
 * El texto decimal de la base en su forma canónica (sin los ceros sobrantes de la fracción ni un punto final), o null
 * si no es un valor oficial (cero, signo, exponente, más de 12 enteros u 8 decimales).
 */
export function aValorOficial(texto: string): string | null {
  const sinCeros = texto.includes(".") ? texto.replace(/0+$/, "").replace(/\.$/, "") : texto;
  return esValorOficial(sinCeros) ? sinCeros : null;
}

const decimalesDe = (texto: string): number => (texto.split(".")[1] ?? "").length;

/** El valor (ya validado) como entero escalado a `escala` decimales. */
function escalado(texto: string, escala: number): bigint {
  const [entero = "", fraccion = ""] = texto.split(".");
  return BigInt(`${entero}${fraccion.padEnd(escala, "0")}`);
}

/** (final / base − 1) × 100 con DECIMALES_VARIACION decimales; la mitad, lejos de cero. Sin «-0.00». */
function porcentaje(base: string, final: string): string {
  const escala = Math.max(decimalesDe(base), decimalesDe(final));
  const b = escalado(base, escala);
  const numerador = (escalado(final, escala) - b) * CIEN * DIEZ ** BigInt(DECIMALES_VARIACION);
  const absoluto = numerador < 0n ? -numerador : numerador;
  const cociente = absoluto / b + (2n * (absoluto % b) >= b ? 1n : 0n);
  const unidad = DIEZ ** BigInt(DECIMALES_VARIACION);
  const texto = `${cociente / unidad}.${(cociente % unidad).toString().padStart(DECIMALES_VARIACION, "0")}`;
  return numerador < 0n && cociente > 0n ? `-${texto}` : texto;
}

const esInstante = (d: Date): boolean => d instanceof Date && Number.isFinite(d.getTime());
/** Días a medianoche UTC, la vigencia al derecho (desde ≤ hasta) y un instante válido. */
const fechasValidas = (c: CifraOficial): boolean =>
  esFechaDeNegocio(c.desde) && esFechaDeNegocio(c.hasta) && c.desde.getTime() <= c.hasta.getTime() && esInstante(c.traidoEn);

function validarParaVariacion(base: CifraOficial, final: CifraOficial): void {
  if (base.origen !== "OFICIAL" || final.origen !== "OFICIAL") throw new ErrorLecturaSeries("NO_ES_OFICIAL");
  if (base.serie !== final.serie) throw new ErrorLecturaSeries("SERIES_DISTINTAS");
  if (!SERIES_INDICE.includes(final.serie)) throw new ErrorLecturaSeries("NO_ES_INDICE");
  if (!fechasValidas(base) || !fechasValidas(final)) throw new ErrorLecturaSeries("FECHA_INVALIDA");
  if (base.hasta.getTime() >= final.desde.getTime()) throw new ErrorLecturaSeries("BASE_NO_ANTERIOR");
  if (!esValorOficial(base.valor) || !esValorOficial(final.valor)) throw new ErrorLecturaSeries("VALOR_INVALIDO");
}

/**
 * La variación de un índice entre dos periodos (p. ej. la anual del IPC: el mes contra el mismo mes del año anterior),
 * CALCULADA por 008: (final / base − 1) × 100. Solo entre dos cifras OFICIALES de una misma serie índice, con la base
 * terminada antes de que empiece el final. Qué periodos comparar lo decide quien llama (C6a); para leer los dos en una
 * misma foto, use una transacción de solo lectura.
 */
export function variacionIndice(base: CifraOficial, final: CifraOficial): CifraOficial {
  validarParaVariacion(base, final);
  const traidoEn = Math.max(base.traidoEn.getTime(), final.traidoEn.getTime());
  return Object.freeze({
    serie: final.serie,
    valor: porcentaje(base.valor, final.valor),
    unidad: UNIDAD_VARIACION,
    desde: new Date(base.desde.getTime()),
    hasta: new Date(final.hasta.getTime()),
    fuente: final.fuente,
    traidoEn: new Date(traidoEn),
    origen: "CALCULADA" as const,
  });
}
