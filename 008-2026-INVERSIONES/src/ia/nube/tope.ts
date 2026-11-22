import "server-only";
/**
 * El tope mensual de la puerta nube, en aritmética entera: micro-USD (millonésimas de dólar) en BigInt, sin coma
 * flotante. Antes de cada llamada: lo gastado en el mes + lo reservado + el costo MÁXIMO de esta llamada ≤ tope.
 *
 * El costo máximo es una cota conservadora:
 * - entrada: los bytes UTF-8 del cuerpo que sale por el cable más un margen fijo, al precio de entrada (supuesto, a
 *   medir en la evaluación E7 con `usage.input_tokens`: un token cubre al menos un byte; el margen cubre lo que la API
 *   agregue al pedido);
 * - salida: `max_tokens` completo (el pensamiento cuenta dentro de `max_tokens`), al precio de salida.
 */
import { esDe, esObjetoPlano } from "../formas";
import { MODELOS_NUBE, MODELO_NUBE, type ModeloNube } from "./peticion";

/**
 * Precios de `claude-opus-5-5` por token, en micro-USD: USD 4 y USD 20 por millón de tokens de entrada y de salida.
 * Fuente: skill claude-api, tabla «Current Models» (la caché que trae la skill), leída al construir este frente. POR VERIFICAR contra
 * la página de precios de Anthropic y la factura antes de encender la puerta: no cubren recargos de la cuenta (región
 * de inferencia por omisión del espacio de trabajo, modo rápido, que este cliente no pide). Si cambian, se cambian aquí
 * (y su prueba).
 */
export const PRECIO_ENTRADA_MICRO_USD_POR_TOKEN = 4n;
export const PRECIO_SALIDA_MICRO_USD_POR_TOKEN = 20n;
/** Tokens de entrada que se suman a la cota por bytes. Propuesta sin medir: se ajusta con la evaluación E7. */
export const MARGEN_TOKENS_ENTRADA = 4096n;

/** El precio de un tramo: micro-USD POR MILLÓN de tokens (haiku no cabe en micro-USD enteros por token). */
export interface PrecioNube {
  readonly entradaPorMillon: bigint;
  readonly salidaPorMillon: bigint;
}

/** La tarifa de un modelo: el tramo base y, si lo tiene, el de los pedidos largos (desde N tokens de entrada). */
export interface TarifaNube {
  readonly base: PrecioNube;
  readonly largo?: { readonly desdeTokensEntrada: number; readonly precio: PrecioNube };
}

const precio = (entradaPorMillon: bigint, salidaPorMillon: bigint): PrecioNube => Object.freeze({ entradaPorMillon, salidaPorMillon });

/**
 * Las tarifas de los modelos que Jelk puede elegir (E8). Fuente: skill claude-api, tabla «Current Models» (caché
 * la de la skill), leída al construir este frente; POR VERIFICAR contra la página de precios y la factura antes de encender:
 * - opus 5.5: USD 4 y 20 por millón (los mismos de PRECIO_*_POR_TOKEN);
 * - sonnet 5.5: USD 2 y 10;
 * - haiku 5.5: USD 0,10 y 0,50 con pedidos de hasta 100K tokens de entrada; por encima, USD 0,50 y 2,50.
 */
export const TARIFAS_NUBE: Readonly<Record<ModeloNube, TarifaNube>> = Object.freeze({
  "claude-opus-5-5": Object.freeze({ base: precio(4_000_000n, 20_000_000n) }),
  "claude-sonnet-5-5": Object.freeze({ base: precio(2_000_000n, 10_000_000n) }),
  "claude-haiku-5-5": Object.freeze({ base: precio(100_000n, 500_000n), largo: Object.freeze({ desdeTokensEntrada: 100_001, precio: precio(500_000n, 2_500_000n) }) }),
});

const UN_MILLON = 1_000_000n;

/** El precio del tramo que corresponde a esa entrada. */
function precioDelTramo(modelo: ModeloNube, tokensEntrada: bigint): PrecioNube {
  const { base, largo } = TARIFAS_NUBE[modelo];
  return largo !== undefined && tokensEntrada >= BigInt(largo.desdeTokensEntrada) ? largo.precio : base;
}

/** División entera hacia arriba (no negativos): el costo nunca se redondea a favor del gasto. */
const haciaArriba = (numerador: bigint): bigint => (numerador + UN_MILLON - 1n) / UN_MILLON;

function costoEnTokens(modelo: ModeloNube, tokensEntrada: bigint, tokensSalida: bigint): bigint {
  const p = precioDelTramo(modelo, tokensEntrada);
  return haciaArriba(tokensEntrada * p.entradaPorMillon + tokensSalida * p.salidaPorMillon);
}

/** El costo de unos tokens ya gastados con ese modelo y en ese tramo, en micro-USD redondeados hacia arriba. */
export function costoTokensMicroUsd(modelo: ModeloNube, tokensEntrada: number, tokensSalida: number): bigint {
  return costoEnTokens(modelo, BigInt(tokensEntrada), BigInt(tokensSalida));
}

/**
 * El modelo de la lista que nombra el `model` que devolvió la API (guardado como `modeloDigest`), si es exactamente uno
 * de sus ids; si no, null (quien valore lo cobra al precio más alto: el tope solo se vuelve más estricto).
 */
export function modeloDeDigest(digest: unknown): ModeloNube | null {
  return esDe(MODELOS_NUBE, digest) ? digest : null;
}

/**
 * Lo gastado por la puerta nube en el mes en curso (hora de Colombia), en tokens, según el registro (`resumen_ia`).
 * `mes` es «AAAA-MM»: con él, lo reservado de un mes no se cuenta en el siguiente.
 */
export interface GastoDelMes {
  readonly mes: string;
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
  /**
   * E8, opcional: lo gastado ya valorado, cada corrida con el precio de su modelo (`gastoNubeDelMes`, src/ia/config).
   * Si no viene, los tokens se valoran al precio más alto de la lista (opus), como antes.
   */
  readonly microUsd?: bigint;
}

/** La lectura del gasto del mes: la implementa el registro (E3) y la conecta el servicio (E6). */
export type LeerGastoDelMes = () => Promise<GastoDelMes>;

const PATRON_MES = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;
const esConteo = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;

/** ¿Tiene el gasto la forma exacta? Objeto plano de datos (sin Proxy ni getters), mes válido y conteos enteros. */
export function esGastoDelMes(valor: unknown): valor is GastoDelMes {
  if (!esObjetoPlano(valor)) return false;
  const { mes, tokensEntrada, tokensSalida, microUsd } = valor;
  const valorado = microUsd === undefined || (typeof microUsd === "bigint" && microUsd >= 0n);
  return typeof mes === "string" && PATRON_MES.test(mes) && esConteo(tokensEntrada) && esConteo(tokensSalida) && valorado;
}

/** El costo de lo gastado: el ya valorado si viene; si no, los tokens al precio de opus (el más alto de la lista). */
export function costoMicroUsd(gasto: GastoDelMes): bigint {
  if (typeof gasto.microUsd === "bigint") return gasto.microUsd;
  return BigInt(gasto.tokensEntrada) * PRECIO_ENTRADA_MICRO_USD_POR_TOKEN + BigInt(gasto.tokensSalida) * PRECIO_SALIDA_MICRO_USD_POR_TOKEN;
}

/**
 * El costo máximo de una llamada con ese modelo (por omisión, opus): (bytes del cuerpo + margen) de entrada y
 * `maxTokens` de salida, con el tramo que corresponde a esa entrada.
 */
export function costoMaximoMicroUsd(cuerpoJson: string, maxTokens: number, modelo: ModeloNube = MODELO_NUBE): bigint {
  const tokensEntrada = BigInt(Buffer.byteLength(cuerpoJson, "utf8")) + MARGEN_TOKENS_ENTRADA;
  return costoEnTokens(modelo, tokensEntrada, BigInt(maxTokens));
}

/** ¿Cabe la llamada? «Justo» cabe; pasar el tope por un micro-USD, no. */
export function cabeEnElTope(gastadoMicroUsd: bigint, maximoMicroUsd: bigint, topeMicroUsd: bigint): boolean {
  return gastadoMicroUsd + maximoMicroUsd <= topeMicroUsd;
}
