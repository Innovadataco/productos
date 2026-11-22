/**
 * Robustez: con salidas hostiles del tamaño máximo (una palabra enorme, miles de frases, citas a montones, anidamiento),
 * `validarSalida` responde rápido y nunca lanza; con texto al azar (semilla fija), tampoco. El tope de tiempo es holgado:
 * mide que no haya trabajo cuadrático, no la velocidad de la máquina.
 */
import { describe, expect, it } from "vitest";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteFicticio } from "./apoyo/salidas.ficticio";

const TOPE_MS = 2_000;
const p = paqueteFicticio("DIARIO");

const conTexto = (texto: string): string => JSON.stringify({ frases: [{ hechos: [], texto }] });
const ajustar = (armar: (n: number) => string): string => {
  let n = MAX_SALIDA_CRUDA;
  let cruda = armar(n);
  while (cruda.length > MAX_SALIDA_CRUDA) {
    n -= cruda.length - MAX_SALIDA_CRUDA;
    cruda = armar(n);
  }
  return cruda;
};

const HOSTILES: readonly (readonly [string, string])[] = [
  ["una palabra enorme que termina en «rá»", ajustar((n) => conTexto(`${"a".repeat(Math.max(n - 40, 0))}rá.`))],
  ["una palabra enorme de dieci…", ajustar((n) => conTexto(`dieci${"a".repeat(Math.max(n - 40, 0))}.`))],
  ["va a seguido de una palabra enorme", ajustar((n) => conTexto(`va a ${"a".repeat(Math.max(n - 40, 0))}.`))],
  ["miles de frases", ajustar((n) => JSON.stringify({ frases: Array.from({ length: Math.max(Math.floor(n / 26), 0) }, () => ({ hechos: [], texto: "x" })) }))],
  ["citas a montones", ajustar((n) => conTexto("{H03} ".repeat(Math.max(Math.floor(n / 6) - 8, 0))))],
  ["palabras de dirección a montones", ajustar((n) => conTexto("subió bajó ".repeat(Math.max(Math.floor(n / 11) - 4, 0))))],
  ["comas y llaves", ajustar((n) => conTexto(",{".repeat(Math.max(Math.floor(n / 2) - 20, 0))))],
  ["espacios", ajustar((n) => conTexto(" ".repeat(Math.max(n - 40, 0))))],
  ["anidamiento", "[".repeat(MAX_SALIDA_CRUDA)],
];

describe("salidas hostiles", () => {
  it.each(HOSTILES)("%s: rechaza sin lanzar y bajo el tope de tiempo", (_caso, cruda) => {
    expect(cruda.length).toBeLessThanOrEqual(MAX_SALIDA_CRUDA);
    const inicio = performance.now();
    const r = validarSalida(cruda, p);
    expect(performance.now() - inicio).toBeLessThan(TOPE_MS);
    expect(r.ok).toBe(false);
  });
});

describe("texto al azar", () => {
  it("nunca lanza (semilla fija)", () => {
    const prng = crearPrng(7_391);
    const alfabeto = [..."abcdeñáéíóúü ,.;:(){}H0123456789«»$%−-ABCZ​ \nоα📈"];
    for (let i = 0; i < 400; i += 1) {
      const largo = prng.enteroMenorQue(120);
      const texto = Array.from({ length: largo }, () => alfabeto[prng.enteroMenorQue(alfabeto.length)]).join("");
      const hechos = Array.from({ length: prng.enteroMenorQue(4) }, () => `H0${1 + prng.enteroMenorQue(9)}`);
      expect(() => validarSalida(JSON.stringify({ frases: [{ hechos, texto }] }), p)).not.toThrow();
      expect(() => validarSalida(texto, p)).not.toThrow();
    }
  });
});
