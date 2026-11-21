/**
 * Fuzz del lector (determinista, con semilla): miles de PDF mutados al azar. La única salida aceptada es
 * leer bien o fallar con ErrorPdf / ErrorTabla (mensaje fijo, sin datos). Cualquier otra excepción
 * (TypeError, RangeError, desbordar la pila) o un cuelgue es un defecto del lector.
 */
import { describe, expect, it } from "vitest";
import { ErrorPdf } from "@/importacion/av/pdf/errores";
import { extraerLineas } from "@/importacion/av/pdf/lector";
import { ErrorTabla, leerTablaCertificacion } from "@/importacion/av/tabla";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../../../fixtures/av/certificacion.ficticio";

/** mulberry32: PRNG pequeño y determinista (las corridas se repiten igual). */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Desenlace = "leido" | "rechazado";

function leer(bytes: Uint8Array): Desenlace {
  try {
    leerTablaCertificacion(extraerLineas(bytes));
    return "leido";
  } catch (e) {
    if (e instanceof ErrorPdf || e instanceof ErrorTabla) {
      expect(e.message).not.toMatch(/FICT|999000111|COP|Titular/);
      return "rechazado";
    }
    throw e;
  }
}

type Mutacion = (b: Uint8Array, r: () => number) => Uint8Array;
const pos = (b: Uint8Array, r: () => number) => Math.floor(r() * b.length);

const MUTACIONES: readonly Mutacion[] = [
  (b, r) => b.map((v) => (r() < 0.002 ? v ^ (1 << Math.floor(r() * 8)) : v)),
  (b, r) => b.subarray(0, pos(b, r)),
  (b, r) => {
    const i = pos(b, r);
    return Uint8Array.from([...b.subarray(0, i), ...Array.from({ length: 1 + Math.floor(r() * 16) }, () => Math.floor(r() * 256)), ...b.subarray(i)]);
  },
  (b, r) => {
    const [i, j] = [pos(b, r), pos(b, r)].sort((x, y) => x - y);
    return Uint8Array.from([...b.subarray(0, j!), ...b.subarray(i!, j!), ...b.subarray(j!)]);
  },
  (b, r) => {
    const delims = [0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x2f, 0x5c, 0x25, 0x0a];
    const copia = b.slice();
    for (let k = 0; k < 4; k += 1) copia[pos(b, r)] = delims[Math.floor(r() * delims.length)]!;
    return copia;
  },
];

function fuzz(base: Uint8Array, semilla: number, vueltas: number): Record<Desenlace, number> {
  const r = azar(semilla);
  const conteo: Record<Desenlace, number> = { leido: 0, rechazado: 0 };
  for (let k = 0; k < vueltas; k += 1) conteo[leer(MUTACIONES[k % MUTACIONES.length]!(base, r))] += 1;
  return conteo;
}

/** Rangos [inicio, fin) de los content streams de texto (sin comprimir): mutar ahí no mueve la xref. */
function rangosDeContenido(b: Uint8Array): [number, number][] {
  const texto = Buffer.from(b).toString("latin1");
  const rangos: [number, number][] = [];
  const re = /\/Length (\d+)\n>>\nstream\n(?=0\.57 w)/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) rangos.push([m.index + m[0].length, m.index + m[0].length + Number(m[1])]);
  return rangos;
}

/** Mutación del mismo largo dentro del contenido: llega hasta el intérprete y la tabla. */
function mutarContenido(base: Uint8Array, rangos: readonly [number, number][], r: () => number): Uint8Array {
  const copia = base.slice();
  const alfabeto = Buffer.from("()<>[]/\\% \n0123456789.-TJjdmfBEqQ'\"COPFICT,");
  for (let k = 0; k < 1 + Math.floor(r() * 6); k += 1) {
    const [i, j] = rangos[Math.floor(r() * rangos.length)]!;
    copia[i + Math.floor(r() * (j - i))] = alfabeto[Math.floor(r() * alfabeto.length)]!;
  }
  return copia;
}

const VOCABULARIO = ["BT", "ET", "q", "Q", "cm", "Td", "TD", "Tm", "T*", "Tj", "TJ", "'", '"', "Tf", "TL", "Tr", "/F1", "/F7", "/X", "(a)", "(COP 1,00)", "<41>", "[", "]", "<<", ">>", "1", "-2.5", "0", "700", "1e3", "re", "f", "Do", "BI", "ZZ"];

describe("fuzz del lector de la certificación", () => {
  it("bytes mutados al azar (sin comprimir): solo lee o rechaza con un código", { timeout: 60_000 }, () => {
    const conteo = fuzz(generarCertificacionPdf(), 1, 1500);
    expect(conteo.leido + conteo.rechazado).toBe(1500);
    expect(conteo.rechazado).toBeGreaterThan(0);
  });

  it("bytes mutados al azar (FlateDecode): solo lee o rechaza con un código", { timeout: 60_000 }, () => {
    const conteo = fuzz(generarCertificacionPdf(CERTIFICACION_FICTICIA, { comprimir: true }), 2, 1500);
    expect(conteo.leido + conteo.rechazado).toBe(1500);
  });

  it("bytes mutados dentro del contenido de las páginas (la xref sigue valiendo): solo lee o rechaza", { timeout: 60_000 }, () => {
    const base = generarCertificacionPdf();
    const rangos = rangosDeContenido(base);
    expect(rangos).toHaveLength(2);
    const r = azar(4);
    for (let k = 0; k < 2000; k += 1) leer(mutarContenido(base, rangos, r));
  });

  it("contenido de página armado al azar con operadores y operandos: solo lee o rechaza", { timeout: 60_000 }, () => {
    const r = azar(3);
    for (let k = 0; k < 400; k += 1) {
      const sopa = Array.from({ length: 1 + Math.floor(r() * 40) }, () => VOCABULARIO[Math.floor(r() * VOCABULARIO.length)]!).join(" ");
      leer(generarCertificacionPdf(CERTIFICACION_FICTICIA, { contenidoExtra: sopa }));
    }
  });

  it("un anidamiento de 100 000 corchetes falla con un código, sin desbordar la pila", () => {
    const pdf = generarCertificacionPdf(CERTIFICACION_FICTICIA, { contenidoExtra: "[".repeat(100_000) });
    expect(() => extraerLineas(pdf)).toThrow(expect.objectContaining({ codigo: "PDF_PROFUNDIDAD_EXCESIVA" }));
  });

  it("medio millón de operadores falla con un código en poco tiempo", { timeout: 30_000 }, () => {
    const pdf = generarCertificacionPdf(CERTIFICACION_FICTICIA, { contenidoExtra: "n ".repeat(600_000), comprimir: true });
    expect(() => extraerLineas(pdf)).toThrow(expect.objectContaining({ codigo: "PDF_DEMASIADO_TEXTO" }));
  });
});
