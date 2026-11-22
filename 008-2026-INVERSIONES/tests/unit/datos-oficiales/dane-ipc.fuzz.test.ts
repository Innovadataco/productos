// Fuzz con semilla del lector del anexo del IPC (src/datos-oficiales/fuentes/dane-ipc.ts): bytes del xlsx mutados y
// caracteres de la hoja mutados (y vueltos a comprimir). Nunca lanza, nunca sale ERROR_INTERNO (un fallo no previsto
// no se esconde como «cambió el DANE»), solo devuelve códigos conocidos y, si lee, lo que lee entra al CSV canónico.
// Las corridas se repiten igual (mulberry32, tests/unit/lib/fixtures/azar.ts). Valores inventados.
import { describe, expect, it } from "vitest";
import { azar, entero } from "../lib/fixtures/azar";
import { anexoIpc } from "./anexo-ipc.ficticio";
import { leerAnexoIpc, type LecturaAnexoIpc } from "@/datos-oficiales/fuentes/dane-ipc";
import { escribirCsvSeries } from "@/datos-oficiales/series/csv-series";

const HOY = new Date(Date.UTC(2027, 2, 17));
const CODIGOS = new Set([
  "ANEXO_ZIP", "ANEXO_XML", "DANE_FORMATO", "DANE_BASE_DISTINTA", "DANE_ANIOS", "DANE_MES_DESCONOCIDO", "DANE_CELDA", "DANE_VALOR",
  "VALOR_FUERA_DE_RANGO", "DANE_HUECO", "SIN_VALORES", "MES_ABIERTO",
]);
const CARACTERES = ['<', '>', '"', "/", "=", "&", " ", "1", "9", ".", "E", "-", "a", "s", "t", "r", "x", " ", "Í"];
const CORRIDAS = 250;

function comprobar(r: LecturaAnexoIpc, caso: string): void {
  if (r.ok) {
    expect(escribirCsvSeries([{ codigo: "IPC_INDICE", valores: r.valores }], HOY), caso).toMatchObject({ ok: true });
    return;
  }
  expect(CODIGOS.has(r.codigo), `${caso}: ${r.codigo}`).toBe(true);
  if (r.celda !== undefined) expect(r.celda, caso).toMatch(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/);
}

/** Muta 1 a 6 posiciones de `texto`: reemplaza, borra o duplica un trozo. */
function mutarTexto(texto: string, r: () => number): string {
  let salida = texto;
  for (let n = 1 + entero(r, 6); n > 0; n -= 1) {
    const p = entero(r, salida.length);
    const accion = entero(r, 3);
    if (accion === 0) salida = salida.slice(0, p) + CARACTERES[entero(r, CARACTERES.length)] + salida.slice(p + 1);
    else if (accion === 1) salida = salida.slice(0, p) + salida.slice(p + 1 + entero(r, 8));
    else salida = salida.slice(0, p) + salida.slice(p, p + 1 + entero(r, 40)) + salida.slice(p);
  }
  return salida;
}

describe("fuzz · el lector del anexo del IPC nunca lanza ni esconde un error interno", () => {
  it(`${CORRIDAS} anexos con bytes mutados`, () => {
    const base = anexoIpc();
    for (let semilla = 1; semilla <= CORRIDAS; semilla += 1) {
      const r = azar(semilla);
      const bytes = Uint8Array.from(base);
      for (let n = 1 + entero(r, 8); n > 0; n -= 1) bytes[entero(r, bytes.length)] = entero(r, 256);
      comprobar(leerAnexoIpc(bytes, HOY), `bytes, semilla ${semilla}`);
    }
  });

  it(`${CORRIDAS} anexos con la hoja mutada y vuelta a comprimir`, () => {
    let leidos = 0;
    for (let semilla = 1; semilla <= CORRIDAS; semilla += 1) {
      const r = azar(10_000 + semilla);
      const resultado = leerAnexoIpc(anexoIpc({ hoja: (x) => mutarTexto(x, r) }), HOY);
      if (resultado.ok) leidos += 1;
      comprobar(resultado, `hoja, semilla ${semilla}`);
    }
    // Control: algunas mutaciones caen en lo que no se lee y el anexo sigue sirviendo; otras no.
    expect(leidos).toBeGreaterThan(0);
    expect(leidos).toBeLessThan(CORRIDAS);
  });

  // code-reviewer B3: el libro y sus relaciones también (ahí se resuelve qué parte es la hoja y cuál los textos).
  it(`${CORRIDAS} anexos con el libro mutado y ${CORRIDAS} con sus relaciones mutadas`, () => {
    for (let semilla = 1; semilla <= CORRIDAS; semilla += 1) {
      const r = azar(30_000 + semilla);
      comprobar(leerAnexoIpc(anexoIpc({ libro: (x) => mutarTexto(x, r) }), HOY), `libro, semilla ${semilla}`);
      comprobar(leerAnexoIpc(anexoIpc({ rels: (x) => mutarTexto(x, r) }), HOY), `relaciones, semilla ${semilla}`);
    }
  });

  it(`${CORRIDAS} anexos con los textos compartidos mutados`, () => {
    for (let semilla = 1; semilla <= CORRIDAS; semilla += 1) {
      const r = azar(20_000 + semilla);
      comprobar(leerAnexoIpc(anexoIpc({ textos: (x) => mutarTexto(x, r) }), HOY), `textos, semilla ${semilla}`);
    }
  });
});
