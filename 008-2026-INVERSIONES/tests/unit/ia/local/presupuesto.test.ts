/**
 * El presupuesto del contexto de la puerta local (T7): antes de llamar, se estima el pedido (caracteres entre 2,2) más una
 * reserva para la salida; si no cabe en `num_ctx`, no se llama. Después, si el modelo reporta entrada más salida igual o
 * mayor que el contexto, el pedido se perdió por contexto lleno. Puro, sin red.
 */
import { describe, expect, it } from "vitest";
import { NUM_CTX_LOCAL } from "@/ia/local/ollama";
import { CARACTERES_POR_TOKEN, RESERVA_SALIDA_TOKENS, cabeEnElContexto, contextoLleno, tokensEstimados } from "@/ia/local/presupuesto";

/** Los caracteres que dejan el pedido justo en el límite: (contexto − reserva) tokens a 2,2 caracteres cada uno. */
const CARACTERES_JUSTOS = Math.floor((NUM_CTX_LOCAL - RESERVA_SALIDA_TOKENS) * CARACTERES_POR_TOKEN);

describe("constantes", () => {
  it("2,2 caracteres por token, 1.024 tokens de reserva y el contexto fijo de la puerta", () => {
    expect(CARACTERES_POR_TOKEN).toBe(2.2);
    expect(RESERVA_SALIDA_TOKENS).toBe(1024);
    expect(NUM_CTX_LOCAL).toBe(8192);
  });
});

describe("tokensEstimados", () => {
  it("cero caracteres, cero tokens; si no es exacto, sube al entero siguiente", () => {
    expect(tokensEstimados(0)).toBe(0);
    expect(tokensEstimados(22)).toBe(10);
    expect(tokensEstimados(23)).toBe(11);
    expect(tokensEstimados(1)).toBe(1);
  });
  it("un largo que no es un entero no negativo lanza RangeError (defecto del código)", () => {
    for (const malo of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => tokensEstimados(malo)).toThrow(RangeError);
  });
});

describe("cabeEnElContexto", () => {
  it("cabe justo en el límite y no cabe con un carácter más", () => {
    expect(cabeEnElContexto(CARACTERES_JUSTOS)).toBe(true);
    expect(cabeEnElContexto(CARACTERES_JUSTOS + 1)).toBe(false);
  });
  it("un pedido corto cabe y uno enorme no", () => {
    expect(cabeEnElContexto(1237)).toBe(true);
    expect(cabeEnElContexto(1_000_000)).toBe(false);
  });
});

describe("contextoLleno", () => {
  it("la suma de entrada y salida igual o mayor que el contexto es contexto lleno", () => {
    expect(contextoLleno(7000, NUM_CTX_LOCAL - 7000)).toBe(true);
    expect(contextoLleno(7000, NUM_CTX_LOCAL - 7000 + 1)).toBe(true);
    expect(contextoLleno(7000, NUM_CTX_LOCAL - 7000 - 1)).toBe(false);
  });
  it("sin alguno de los dos conteos no se puede decir: no es contexto lleno", () => {
    expect(contextoLleno(null, 100)).toBe(false);
    expect(contextoLleno(100, null)).toBe(false);
    expect(contextoLleno(null, null)).toBe(false);
  });
});
