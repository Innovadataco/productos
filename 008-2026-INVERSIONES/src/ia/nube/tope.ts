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
import { esObjetoPlano } from "../formas";

/**
 * Precios de `claude-opus-5-5` por token, en micro-USD: USD 4 y USD 20 por millón de tokens de entrada y de salida.
 * Fuente: skill claude-api, tabla «Current Models» (la caché que trae la skill), leída al construir este frente. Si Anthropic cambia
 * el precio, se cambia aquí (y su prueba).
 */
export const PRECIO_ENTRADA_MICRO_USD_POR_TOKEN = 4n;
export const PRECIO_SALIDA_MICRO_USD_POR_TOKEN = 20n;
/** Tokens de entrada que se suman a la cota por bytes. Propuesta sin medir: se ajusta con la evaluación E7. */
export const MARGEN_TOKENS_ENTRADA = 4096n;

/**
 * Lo gastado por la puerta nube en el mes en curso (hora de Colombia), en tokens, según el registro (`resumen_ia`).
 * `mes` es «AAAA-MM»: con él, lo reservado de un mes no se cuenta en el siguiente.
 */
export interface GastoDelMes {
  readonly mes: string;
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
}

/** La lectura del gasto del mes: la implementa el registro (E3) y la conecta el servicio (E6). */
export type LeerGastoDelMes = () => Promise<GastoDelMes>;

const PATRON_MES = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;
const esConteo = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;

/** ¿Tiene el gasto la forma exacta? Objeto plano de datos (sin Proxy ni getters), mes válido y conteos enteros. */
export function esGastoDelMes(valor: unknown): valor is GastoDelMes {
  if (!esObjetoPlano(valor)) return false;
  const { mes, tokensEntrada, tokensSalida } = valor;
  return typeof mes === "string" && PATRON_MES.test(mes) && esConteo(tokensEntrada) && esConteo(tokensSalida);
}

/** El costo de unos tokens ya gastados. */
export function costoMicroUsd(gasto: GastoDelMes): bigint {
  return BigInt(gasto.tokensEntrada) * PRECIO_ENTRADA_MICRO_USD_POR_TOKEN + BigInt(gasto.tokensSalida) * PRECIO_SALIDA_MICRO_USD_POR_TOKEN;
}

/** El costo máximo de una llamada: (bytes del cuerpo + margen) de entrada y `maxTokens` de salida. */
export function costoMaximoMicroUsd(cuerpoJson: string, maxTokens: number): bigint {
  const tokensEntrada = BigInt(Buffer.byteLength(cuerpoJson, "utf8")) + MARGEN_TOKENS_ENTRADA;
  return tokensEntrada * PRECIO_ENTRADA_MICRO_USD_POR_TOKEN + BigInt(maxTokens) * PRECIO_SALIDA_MICRO_USD_POR_TOKEN;
}

/** ¿Cabe la llamada? «Justo» cabe; pasar el tope por un micro-USD, no. */
export function cabeEnElTope(gastadoMicroUsd: bigint, maximoMicroUsd: bigint, topeMicroUsd: bigint): boolean {
  return gastadoMicroUsd + maximoMicroUsd <= topeMicroUsd;
}
