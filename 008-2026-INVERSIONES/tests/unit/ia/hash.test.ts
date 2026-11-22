/**
 * JSON canónico y hash de los hechos: claves ordenadas, sin espacios, sin el campo `hash`; estable ante el orden de
 * las claves y distinto ante cualquier cambio de un valor (también con paquetes al azar, con semilla).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PATRON_HASH, clonCongelado, hashPaquete, jsonCanonico, sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { crearPrng, type Prng } from "@/proyecciones/prng";
import { elegir, paqueteAlAzar } from "./apoyo/aleatorio.ficticio";
import { entradaDiario } from "./apoyo/hechos.ficticio";

const sha = (texto: string): string => createHash("sha256").update(texto, "utf8").digest("hex");

/** Copia con las claves en orden inverso, a todo nivel. */
function barajar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(barajar);
  if (typeof valor !== "object" || valor === null) return valor;
  return Object.fromEntries(Object.entries(valor).reverse().map(([k, v]) => [k, barajar(v)]));
}

describe("sha256Hex", () => {
  it("coincide con los vectores conocidos", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("ñ")).toBe(sha("ñ"));
    expect(PATRON_HASH.test(sha256Hex("x"))).toBe(true);
  });
});

describe("jsonCanonico", () => {
  it("ordena las claves a todo nivel, omite undefined, conserva el orden de los arreglos y no deja espacios", () => {
    const valor = { b: 7, a: [true, null, "x", { d: "ü", c: undefined }], c: { z: "z", y: "y" } };
    expect(jsonCanonico(valor)).toBe('{"a":[true,null,"x",{"d":"ü"}],"b":7,"c":{"y":"y","z":"z"}}');
    expect(jsonCanonico(barajar(valor))).toBe(jsonCanonico(valor));
    expect(jsonCanonico(["b", "a"])).not.toBe(jsonCanonico(["a", "b"]));
  });

  it("ordena por unidades de código, no por idioma", () => {
    expect(jsonCanonico({ b: "1", B: "2", á: "3", a: "4" })).toBe('{"B":"2","a":"4","b":"1","á":"3"}');
  });

  it("acepta objetos sin prototipo", () => {
    const sinPrototipo = Object.assign(Object.create(null) as Record<string, unknown>, { b: "1", a: "2" });
    expect(jsonCanonico(sinPrototipo)).toBe('{"a":"2","b":"1"}');
  });

  it.each([
    ["un decimal", 1.5],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
    ["menos cero", -0],
    ["un entero inseguro", 2 ** 53],
    ["un bigint", 7n],
    ["una fecha", new Date(0)],
    ["un mapa", new Map()],
    ["una función", () => 1],
    ["un símbolo", Symbol("s")],
    ["undefined suelto", undefined],
    ["un arreglo con undefined", [1, undefined]],
    ["un arreglo con huecos", [1, , 3]],
    ["una instancia", new (class Clase {})()],
  ])("lanza TypeError con %s (cierra en fallo)", (_caso, valor) => {
    expect(() => jsonCanonico(valor)).toThrow(TypeError);
  });

  it("lanza TypeError con ciclos y con más de sesenta y cuatro niveles", () => {
    const ciclico: Record<string, unknown> = {};
    ciclico.yo = ciclico;
    expect(() => jsonCanonico(ciclico)).toThrow(TypeError);
    let profundo: unknown = "x";
    for (let i = 0; i < 65; i += 1) profundo = [profundo];
    expect(() => jsonCanonico(profundo)).toThrow(TypeError);
  });
});

describe("hashPaquete", () => {
  it("es el sha256 del JSON canónico escrito a mano, sin el campo hash del primer nivel", () => {
    const paquete = { version: "hechos-v1", tipo: "DIARIO", hoy: "2027-03-17", versionesCalculo: {}, avisos: [], hechos: [{ id: "H01", hash: "interno" }], hash: "cualquiera" };
    const canonico = '{"avisos":[],"hechos":[{"hash":"interno","id":"H01"}],"hoy":"2027-03-17","tipo":"DIARIO","version":"hechos-v1","versionesCalculo":{}}';
    expect(hashPaquete(paquete as never)).toBe(sha(canonico));
    const { hash: _sin, ...sinHash } = paquete;
    expect(hashPaquete(sinHash as never)).toBe(sha(canonico));
  });

  it("el paquete construido lleva su hash, estable ante el orden de las claves", () => {
    const paquete = construirPaquete(entradaDiario());
    expect(paquete.hash).toMatch(PATRON_HASH);
    expect(hashPaquete(paquete)).toBe(paquete.hash);
    expect(hashPaquete(barajar(paquete) as never)).toBe(paquete.hash);
  });

  it("cambia ante cualquier cambio de un valor del paquete de ejemplo", () => {
    const paquete = construirPaquete(entradaDiario());
    const base = hashPaquete(paquete);
    for (const campo of ["valor", "presentacion", "fuente", "fecha", "etiqueta", "unidad", "calidad", "direccion", "frescura", "cercania", "clave", "id"] as const) {
      const hechos = paquete.hechos.map((h, i) => (i === 2 ? { ...h, [campo]: `${h[campo]}x` } : h));
      expect(hashPaquete({ ...paquete, hechos }), campo).not.toBe(base);
    }
    expect(hashPaquete({ ...paquete, hechos: paquete.hechos.map((h, i) => (i === 2 ? { ...h, obligatorio: !h.obligatorio } : h)) })).not.toBe(base);
    expect(hashPaquete({ ...paquete, hechos: paquete.hechos.map((h, i) => (i === 2 ? { ...h, sujeto: "H01" as const } : h)) })).not.toBe(base);
    expect(hashPaquete({ ...paquete, hoy: "2027-03-18" })).not.toBe(base);
    expect(hashPaquete({ ...paquete, avisos: [] })).not.toBe(base);
    expect(hashPaquete({ ...paquete, versionesCalculo: { tablero: "tablero-ficticio-v8" } })).not.toBe(base);
    expect(hashPaquete({ ...paquete, hechos: [...paquete.hechos].reverse() })).not.toBe(base);
  });

  it("propiedad (semilla fija): con trescientos paquetes al azar, barajar no cambia el hash y cambiar un valor sí", () => {
    const prng: Prng = crearPrng(4613);
    for (let i = 0; i < 300; i += 1) {
      const paquete = paqueteAlAzar(prng);
      expect(hashPaquete(barajar(paquete) as never)).toBe(paquete.hash);
      const indice = prng.enteroMenorQue(paquete.hechos.length);
      const campo = elegir(prng, ["valor", "presentacion", "fuente", "fecha"] as const);
      const hechos = paquete.hechos.map((h, j) => (j === indice ? { ...h, [campo]: `${h[campo]}1` } : h));
      expect(hashPaquete({ ...paquete, hechos })).not.toBe(paquete.hash);
    }
  });
});

describe("clonCongelado", () => {
  it("devuelve una copia profunda, igual y congelada a todo nivel", () => {
    const original = { a: [{ b: "x" }], c: { d: true } };
    const copia = clonCongelado(original);
    expect(copia).toEqual(original);
    expect(copia).not.toBe(original);
    expect(Object.isFrozen(copia) && Object.isFrozen(copia.a) && Object.isFrozen(copia.a[0]) && Object.isFrozen(copia.c)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
  });
});
