/**
 * El presupuesto del contexto de la puerta local, puro. Dos controles sobre `num_ctx` (`NUM_CTX_LOCAL`):
 * - ANTES de llamar: el pedido (el prompt y la vista, en caracteres) se estima a `CARACTERES_POR_TOKEN` por token y se le
 *   suma una reserva para la salida; si no cabe, no se llama (sin red y sin reintento: otra vez daría lo mismo);
 * - DESPUÉS: si el modelo reporta entrada más salida igual o mayor que el contexto, el pedido se llenó (la salida se corta o
 *   se descarta lo del comienzo), aunque Ollama diga que terminó bien.
 * La estimación es conservadora a propósito (medida en español con las etiquetas del catálogo: unos 2,2 caracteres por token).
 */
import { NUM_CTX_LOCAL } from "./ollama";

export const CARACTERES_POR_TOKEN = 2.2;
/** Tokens que se dejan libres para la salida del modelo (el JSON de las frases). */
export const RESERVA_SALIDA_TOKENS = 1024;

/** Los tokens estimados de un texto de `caracteres`, por arriba. Un largo que no es un entero no negativo lanza RangeError. */
export function tokensEstimados(caracteres: number): number {
  if (!Number.isSafeInteger(caracteres) || caracteres < 0) throw new RangeError("El largo debe ser un entero no negativo.");
  return Math.ceil(caracteres / CARACTERES_POR_TOKEN);
}

/** ¿El pedido de `caracteres` cabe en el contexto, con la reserva de la salida? */
export function cabeEnElContexto(caracteres: number, contexto: number = NUM_CTX_LOCAL): boolean {
  return tokensEstimados(caracteres) + RESERVA_SALIDA_TOKENS <= contexto;
}

/** ¿Lo que el modelo reportó llena el contexto? Sin alguno de los dos conteos no se puede decir: no. */
export function contextoLleno(tokensEntrada: number | null, tokensSalida: number | null, contexto: number = NUM_CTX_LOCAL): boolean {
  return tokensEntrada !== null && tokensSalida !== null && tokensEntrada + tokensSalida >= contexto;
}
