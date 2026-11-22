/**
 * Fuzz del lector XML acotado (determinista, con semilla fija). La única salida aceptada es leer bien o fallar con
 * ErrorXml de un código propio del lector: ni XML_ERROR_INTERNO (que escondería un defecto), ni TypeError, ni
 * RangeError, ni desbordar la pila, ni colgarse. Más un viaje de ida y vuelta con árboles válidos al azar.
 */
import { describe, expect, it } from "vitest";
import { ErrorXml, leerXmlAcotado, type ElementoXml } from "@/lib/xml-acotado";
import { azar, entero } from "./fixtures/azar";
import { MARCA, SDMX_FICTICIO, utf8 } from "./fixtures/sdmx.ficticio";

type Desenlace = "leido" | "rechazado";

function leer(bytes: Uint8Array): Desenlace {
  try {
    leerXmlAcotado(bytes);
    return "leido";
  } catch (e) {
    if (e instanceof ErrorXml && e.codigo !== "XML_ERROR_INTERNO") {
      expect(e.message).not.toContain(MARCA);
      return "rechazado";
    }
    throw e;
  }
}

type Mutacion = (b: Uint8Array, r: () => number) => Uint8Array;
const pos = (b: Uint8Array, r: () => number) => entero(r, b.length + 1);

const MUTACIONES: readonly Mutacion[] = [
  (b, r) => b.map((v) => (r() < 0.004 ? v ^ (1 << entero(r, 8)) : v)),
  (b, r) => b.subarray(0, pos(b, r)),
  (b, r) => {
    const i = pos(b, r);
    return Uint8Array.from([...b.subarray(0, i), ...Array.from({ length: 1 + entero(r, 12) }, () => entero(r, 256)), ...b.subarray(i)]);
  },
  (b, r) => {
    const [i, j] = [pos(b, r), pos(b, r)].sort((x, y) => x - y) as [number, number];
    return Uint8Array.from([...b.subarray(0, j), ...b.subarray(i, j), ...b.subarray(j)]);
  },
  (b, r) => {
    const delimitadores = utf8(`<>&;"'=/!?:-[]# \n${MARCA}`);
    const copia = b.slice();
    for (let k = 0; k < 4; k += 1) copia[entero(r, b.length)] = delimitadores[entero(r, delimitadores.length)]!;
    return copia;
  },
];

const VOCABULARIO = [
  "<a>", "</a>", "<b/>", "<p:c>", "</p:c>", '<d xmlns:p="urn:f">', "</d>", '<e x="1" x="2"/>', "<!DOCTYPE a>", "<![CDATA[x]]>", "<?p?>",
  "<?xml version='1.0'?>", "<!-- c -->", "<!--", "-->", "&#0;", "&#xD800;", "&#x41;", "&foo;", "&amp;", "&", "]]>", 'xmlns:a="', "a:", "﻿",
  "\u0000", "￿", "texto", " ", "\n", "<", ">", "=", '"', "'", "/", `<${MARCA}>`,
];

describe("fuzz del lector XML acotado", () => {
  it("bytes del mensaje SDMX ficticio mutados al azar: solo lee o rechaza con un código", { timeout: 60_000 }, () => {
    const base = utf8(SDMX_FICTICIO);
    const r = azar(4613);
    const conteo: Record<Desenlace, number> = { leido: 0, rechazado: 0 };
    for (let k = 0; k < 2473; k += 1) conteo[leer(MUTACIONES[k % MUTACIONES.length]!(base, r))] += 1;
    expect(conteo.leido + conteo.rechazado).toBe(2473);
    expect(conteo.rechazado).toBeGreaterThan(0);
    expect(conteo.leido).toBeGreaterThan(0);
  });

  it("sopa de fichas XML armada al azar: solo lee o rechaza con un código", { timeout: 60_000 }, () => {
    const r = azar(37911);
    for (let k = 0; k < 2000; k += 1) {
      const sopa = Array.from({ length: 1 + entero(r, 30) }, () => VOCABULARIO[entero(r, VOCABULARIO.length)]!).join("");
      leer(utf8(sopa));
    }
  });

  it("bytes completamente al azar: solo lee o rechaza con un código", () => {
    const r = azar(1237);
    for (let k = 0; k < 1000; k += 1) leer(Uint8Array.from({ length: entero(r, 64) }, () => entero(r, 256)));
  });
});

describe("ida y vuelta con árboles válidos al azar", () => {
  interface Nodo {
    readonly nombre: string;
    readonly atributos: readonly (readonly [string, string])[];
    readonly hijos: readonly Nodo[];
    readonly texto: string;
  }
  const TEXTOS = ["", "FICT", " 4613.27 ", "a<b", "x&y", "\"comillas\" 'simples'", "ñandú €", "\u{1F600}", "]]", "-1e-3"];

  function arbol(r: () => number, profundidad: number): Nodo {
    const hijos = profundidad < 6 ? Array.from({ length: entero(r, 4) }, () => arbol(r, profundidad + 1)) : [];
    const atributos = Array.from({ length: entero(r, 4) }, (_v, k) => [`at${k}`, TEXTOS[entero(r, TEXTOS.length)]!] as const);
    return { nombre: `n${entero(r, 7)}`, atributos, hijos, texto: TEXTOS[entero(r, TEXTOS.length)]! };
  }

  const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const serializar = (n: Nodo): string =>
    `<${n.nombre}${n.atributos.map(([k, v]) => ` ${k}="${escapar(v)}"`).join("")}>${escapar(n.texto)}${n.hijos.map(serializar).join("")}</${n.nombre}>`;
  const comoNodo = (e: ElementoXml): Nodo => ({
    nombre: e.nombre,
    atributos: e.atributos.map((a) => [a.nombre, a.valor] as const),
    hijos: e.hijos.map(comoNodo),
    texto: e.texto,
  });

  it("serializar → leer devuelve el mismo árbol (300 árboles, semilla fija)", () => {
    const r = azar(4619);
    for (let k = 0; k < 300; k += 1) {
      const original = arbol(r, 1);
      expect(comoNodo(leerXmlAcotado(utf8(serializar(original))))).toEqual(original);
    }
  });
});
