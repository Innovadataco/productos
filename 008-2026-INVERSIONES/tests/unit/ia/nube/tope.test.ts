/**
 * El tope mensual en aritmética entera (micro-USD, BigInt): el costo de lo gastado, el costo máximo de una llamada
 * (la cota de entrada por los bytes del cuerpo más un margen, y `max_tokens` de salida) y la comparación, donde «justo»
 * cabe. El gasto del mes viene de afuera (el registro, E3): se revisa su forma y se cierra en fallo.
 */
import { describe, expect, it } from "vitest";
import {
  MARGEN_TOKENS_ENTRADA, PRECIO_ENTRADA_MICRO_USD_POR_TOKEN, PRECIO_SALIDA_MICRO_USD_POR_TOKEN, cabeEnElTope, costoMaximoMicroUsd,
  costoMicroUsd, esGastoDelMes,
} from "@/ia/nube/tope";
import { GASTO_FICTICIO } from "./apoyo/datos.ficticio";

describe("precios y margen", () => {
  it("claude-opus-5-5: USD 4 y USD 20 por millón de tokens = 4 y 20 micro-USD por token; margen de entrada fijo", () => {
    expect(PRECIO_ENTRADA_MICRO_USD_POR_TOKEN).toBe(4n);
    expect(PRECIO_SALIDA_MICRO_USD_POR_TOKEN).toBe(20n);
    expect(MARGEN_TOKENS_ENTRADA).toBe(4096n);
  });
});

describe("costoMicroUsd", () => {
  it("entrada × 4 + salida × 20", () => {
    expect(costoMicroUsd(GASTO_FICTICIO)).toBe(37911n * 4n + 4613n * 20n);
    expect(costoMicroUsd(GASTO_FICTICIO)).toBe(243_904n);
    expect(costoMicroUsd({ mes: "2027-03", tokensEntrada: 0, tokensSalida: 0 })).toBe(0n);
  });

  it("es exacto por encima de 2^53 (BigInt, sin redondeo de coma flotante)", () => {
    const grande = Number.MAX_SAFE_INTEGER;
    expect(costoMicroUsd({ mes: "2027-03", tokensEntrada: grande, tokensSalida: grande })).toBe(BigInt(grande) * 24n);
  });
});

describe("costoMaximoMicroUsd", () => {
  it("(bytes UTF-8 del cuerpo + margen) × 4 + max_tokens × 20", () => {
    expect(costoMaximoMicroUsd("abc", 8192)).toBe((3n + 4096n) * 4n + 8192n * 20n);
    expect(costoMaximoMicroUsd("abc", 8192)).toBe(180_236n);
  });

  it("cuenta bytes, no caracteres: «ñ» son 2 y «€» son 3", () => {
    expect(costoMaximoMicroUsd("ñ€", 1)).toBe((5n + 4096n) * 4n + 20n);
    expect(costoMaximoMicroUsd("ñ€", 1)).toBe(16_424n);
  });
});

describe("cabeEnElTope", () => {
  it("debajo y justo caben; un micro-USD encima no", () => {
    expect(cabeEnElTope(243_904n, 180_236n, 424_141n)).toBe(true);
    expect(cabeEnElTope(243_904n, 180_236n, 424_140n)).toBe(true);
    expect(cabeEnElTope(243_904n, 180_236n, 424_139n)).toBe(false);
  });
});

describe("esGastoDelMes", () => {
  it("acepta el mes «AAAA-MM» y conteos enteros no negativos", () => {
    expect(esGastoDelMes(GASTO_FICTICIO)).toBe(true);
    expect(esGastoDelMes({ mes: "2027-12", tokensEntrada: 0, tokensSalida: 0 })).toBe(true);
  });

  const getter = Object.defineProperty({ mes: "2027-03", tokensSalida: 4613 }, "tokensEntrada", { get: () => 37911, enumerable: true });
  const proxy = new Proxy({ ...GASTO_FICTICIO }, {});

  it.each([
    ["nulo", null],
    ["un número", 37911],
    ["un arreglo", [37911, 4613]],
    ["sin mes", { tokensEntrada: 37911, tokensSalida: 4613 }],
    ["mes trece", { ...GASTO_FICTICIO, mes: "2027-13" }],
    ["mes con día", { ...GASTO_FICTICIO, mes: "2027-03-17" }],
    ["mes cero", { ...GASTO_FICTICIO, mes: "2027-00" }],
    ["entrada negativa", { ...GASTO_FICTICIO, tokensEntrada: -1 }],
    ["entrada con decimales", { ...GASTO_FICTICIO, tokensEntrada: 37911.5 }],
    ["entrada NaN", { ...GASTO_FICTICIO, tokensEntrada: Number.NaN }],
    ["entrada no segura", { ...GASTO_FICTICIO, tokensEntrada: Number.MAX_SAFE_INTEGER + 2 }],
    ["entrada en texto", { ...GASTO_FICTICIO, tokensEntrada: "37911" }],
    ["entrada en BigInt", { ...GASTO_FICTICIO, tokensEntrada: 37911n }],
    ["salida faltante", { mes: "2027-03", tokensEntrada: 37911 }],
    ["con un getter", getter],
    ["un Proxy", proxy],
  ])("rechaza %s", (_caso, valor) => {
    expect(esGastoDelMes(valor)).toBe(false);
  });
});
