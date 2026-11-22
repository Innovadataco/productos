/**
 * Fuzz del lector zip acotado (determinista, con semilla fija). La única salida aceptada es abrir (y leer cada entrada)
 * o fallar con ErrorZip de un código propio del lector: ni ZIP_ERROR_INTERNO (que escondería un defecto), ni
 * TypeError, ni RangeError, ni colgarse. Más un viaje de ida y vuelta con entradas al azar.
 */
import { describe, expect, it } from "vitest";
import { ErrorZip, abrirZipAcotado } from "@/lib/zip-acotado";
import { azar, bytesAzar, entero } from "./fixtures/azar";
import { armarZip, ascii, xlsxMinimo, type EntradaZip } from "./fixtures/xlsx.ficticio";

type Desenlace = "leido" | "rechazado";

function leer(bytes: Uint8Array): Desenlace {
  try {
    const archivo = abrirZipAcotado(bytes);
    for (const n of archivo.nombres) archivo.leer(n);
    return "leido";
  } catch (e) {
    if (e instanceof ErrorZip && e.codigo !== "ZIP_ERROR_INTERNO") return "rechazado";
    throw e;
  }
}

type Mutacion = (b: Uint8Array, r: () => number) => Uint8Array;
const pos = (b: Uint8Array, r: () => number) => entero(r, b.length + 1);

const MUTACIONES: readonly Mutacion[] = [
  (b, r) => b.map((v) => (r() < 0.003 ? v ^ (1 << entero(r, 8)) : v)),
  (b, r) => b.subarray(0, pos(b, r)),
  (b, r) => {
    const i = pos(b, r);
    return Uint8Array.from([...b.subarray(0, i), ...Array.from({ length: 1 + entero(r, 8) }, () => entero(r, 256)), ...b.subarray(i)]);
  },
  (b, r) => {
    const [i, j] = [pos(b, r), pos(b, r)].sort((x, y) => x - y) as [number, number];
    return Uint8Array.from([...b.subarray(0, j), ...b.subarray(i, j), ...b.subarray(j)]);
  },
];

/** Posiciones de las firmas PK de un zip (cabeceras locales, centrales y fin). */
function firmas(b: Uint8Array): number[] {
  const salida: number[] = [];
  for (let k = 0; k + 3 < b.length; k += 1) if (b[k] === 0x50 && b[k + 1] === 0x4b && (b[k + 2] === 3 || b[k + 2] === 1 || b[k + 2] === 5)) salida.push(k);
  return salida;
}

const VALORES = [0, 1, 0xff, 0xffff, 0xffffffff, 0x7fffffff, 8, 12, 99, 0x0800, 0x0008, 0x0001];

/** Reemplaza un entero de 2 o 4 bytes, cerca de una firma, por un valor de borde o por su vecino. */
function mutarCampo(b: Uint8Array, r: () => number, posiciones: readonly number[]): Uint8Array {
  const copia = b.slice();
  const vista = new DataView(copia.buffer);
  const base = posiciones[entero(r, posiciones.length)]!;
  const desplazamiento = 4 + 2 * entero(r, 21);
  if (base + desplazamiento + 4 > copia.length) return copia;
  const actual = vista.getUint32(base + desplazamiento, true);
  const valor = r() < 0.5 ? VALORES[entero(r, VALORES.length)]! : actual + (r() < 0.5 ? 1 : -1);
  if (r() < 0.5) vista.setUint16(base + desplazamiento, valor & 0xffff, true);
  else vista.setUint32(base + desplazamiento, valor >>> 0, true);
  return copia;
}

describe("fuzz del lector zip acotado", () => {
  it("bytes de un xlsx ficticio mutados al azar: solo abre y lee, o rechaza con un código", { timeout: 60_000 }, () => {
    const base = xlsxMinimo();
    const r = azar(4613);
    const conteo: Record<Desenlace, number> = { leido: 0, rechazado: 0 };
    for (let k = 0; k < 2000; k += 1) conteo[leer(MUTACIONES[k % MUTACIONES.length]!(base, r))] += 1;
    expect(conteo.leido + conteo.rechazado).toBe(2000);
    expect(conteo.rechazado).toBeGreaterThan(0);
  });

  it("enteros de las cabeceras reemplazados por valores de borde: solo abre y lee, o rechaza con un código", { timeout: 60_000 }, () => {
    const base = armarZip([
      { nombre: "a.xml", datos: ascii("FICT a ".repeat(31)) },
      { nombre: "b.xml", datos: ascii("FICT b"), metodo: 0 },
      { nombre: "c.xml", datos: ascii("FICT c ".repeat(7)), descriptor: { firma: true } },
    ]);
    const posiciones = firmas(base);
    expect(posiciones.length).toBe(7);
    const r = azar(37911);
    const conteo: Record<Desenlace, number> = { leido: 0, rechazado: 0 };
    for (let k = 0; k < 2969; k += 1) conteo[leer(mutarCampo(base, r, posiciones))] += 1;
    expect(conteo.rechazado).toBeGreaterThan(0);
  });

  it("bytes completamente al azar (con y sin firma de fin): solo rechaza con un código", () => {
    const r = azar(1237);
    for (let k = 0; k < 1000; k += 1) {
      const azarosos = Uint8Array.from({ length: 22 + entero(r, 200) }, () => entero(r, 256));
      if (k % 2 === 0) azarosos.set([0x50, 0x4b, 0x05, 0x06], azarosos.length - 22);
      leer(azarosos);
    }
  });
});

describe("ida y vuelta con entradas al azar", () => {
  it("armar → abrir → leer devuelve las mismas entradas (200 zips, semilla fija)", () => {
    const r = azar(4619);
    for (let k = 0; k < 200; k += 1) {
      const entradas: EntradaZip[] = Array.from({ length: 1 + entero(r, 6) }, (_v, i) => ({
        nombre: `xl/p${i}-${entero(r, 9973)}.xml`,
        datos: r() < 0.5 ? bytesAzar(k * 31 + i, entero(r, 700)) : ascii("FICT ".repeat(entero(r, 300))),
        metodo: r() < 0.3 ? 0 : 8,
        ...(r() < 0.3 ? { descriptor: { firma: r() < 0.5 } } : {}),
      }));
      const archivo = abrirZipAcotado(armarZip(entradas));
      expect(archivo.nombres).toEqual(entradas.map((e) => e.nombre));
      for (const e of entradas) expect(archivo.leer(e.nombre)).toEqual(e.datos);
    }
  });
});
