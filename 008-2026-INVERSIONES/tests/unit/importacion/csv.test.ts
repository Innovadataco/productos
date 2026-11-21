import { describe, expect, it } from "vitest";
import { ErrorCsv, leerCsv } from "@/importacion/trii/csv";

/** Solo las celdas de cada registro (lo que ya probaban estas pruebas antes de numerar los registros). */
const celdas = (texto: string) => leerCsv(texto).map((r) => r.celdas);
/** Número de cada registro en el archivo (encabezado = 1, contando las líneas vacías omitidas). */
const numeros = (texto: string) => leerCsv(texto).map((r) => r.numero);

describe("leerCsv", () => {
  it("lee comas dentro de comillas y comillas escapadas", () => {
    expect(celdas('a,b\n"1,5","dijo ""hola"""\n')).toEqual([["a", "b"], ["1,5", 'dijo "hola"']]);
  });

  it("quita el BOM UTF-8, acepta CRLF y descarta líneas vacías del final", () => {
    expect(celdas("﻿a,b\r\n1,2\r\n\r\n\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("acepta saltos de línea dentro de comillas", () => {
    expect(celdas('a\n"x\ny"\n')).toEqual([["a"], ["x\ny"]]);
  });

  it("conserva campos vacíos (el Estado de dividendos viene vacío)", () => {
    expect(celdas("a,b,c\n2024-10-17,,5\n")).toEqual([["a", "b", "c"], ["2024-10-17", "", "5"]]);
  });

  it("falla si una comilla queda sin cerrar", () => {
    expect(() => leerCsv('a\n"abierta\n')).toThrow(ErrorCsv);
  });
});

// Bordes del archivo (hueco de pruebas): vacío, solo encabezado, finales de línea y coma final.
describe("leerCsv · bordes del archivo", () => {
  it("un archivo vacío o con solo el BOM no tiene filas", () => {
    expect(celdas("")).toEqual([]);
    expect(celdas("\uFEFF")).toEqual([]);
    expect(celdas("\r\n\n")).toEqual([]);
  });

  it("solo el encabezado, con o sin salto final, es una sola fila", () => {
    for (const texto of ["a,b", "a,b\n", "a,b\r\n", "\uFEFFa,b\r\n"]) expect(celdas(texto), JSON.stringify(texto)).toEqual([["a", "b"]]);
  });

  it("un CRLF dentro de comillas es parte del campo", () => {
    expect(celdas('a\r\n"x\r\ny"\r\n')).toEqual([["a"], ["x\r\ny"]]);
  });

  it("un CR suelto (fin de línea antiguo) también separa filas", () => {
    expect(celdas("a,b\r1,2\r")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("una coma al final deja un último campo vacío, también en la última línea sin salto", () => {
    expect(celdas("a,b,\n1,2,")).toEqual([["a", "b", ""], ["1", "2", ""]]);
  });

  it("como lo entrega Trii: BOM, CRLF y la fecha con coma entre comillas", () => {
    expect(celdas('\uFEFFFecha y hora,Valor total\r\n"14 mar 2024, 3:27 p. m.",500000.0\r\n')).toEqual([
      ["Fecha y hora", "Valor total"],
      ["14 mar 2024, 3:27 p. m.", "500000.0"],
    ]);
  });
});

// O4: una línea totalmente vacía (cero caracteres entre dos saltos, fuera de comillas) se omite en cualquier
// posición, y cada registro conserva su número en el archivo original (trazabilidad). «,,,», «   » y «""» NO
// son vacías: se conservan y las rechaza quien interpreta la fila. Al final se siguen quitando los registros
// en blanco (también «,,,» y «   »), como antes: asimetría documentada (decisión G7).
describe("leerCsv · líneas vacías y numeración (O4)", () => {
  it("omite las vacías en medio y numera cada registro como en el archivo (LF, CRLF y CR suelto)", () => {
    for (const salto of ["\n", "\r\n", "\r"]) {
      const texto = ["h", "1", "", "2", "", "", "3", ""].join(salto);
      expect(leerCsv(texto), JSON.stringify(salto)).toEqual([
        { numero: 1, celdas: ["h"] },
        { numero: 2, celdas: ["1"] },
        { numero: 4, celdas: ["2"] },
        { numero: 7, celdas: ["3"] },
      ]);
    }
  });

  it("omite las vacías antes del encabezado (también tras el BOM): el encabezado conserva su número", () => {
    expect(leerCsv("\uFEFF\n\nh\n1\n")).toEqual([{ numero: 3, celdas: ["h"] }, { numero: 4, celdas: ["1"] }]);
  });

  it("«,,,», «   » y «\"\"» en medio NO son vacías: se conservan con su número", () => {
    expect(leerCsv('h,i\n,,,\n   \n""\n1,2\n')).toEqual([
      { numero: 1, celdas: ["h", "i"] },
      { numero: 2, celdas: ["", "", "", ""] },
      { numero: 3, celdas: ["   "] },
      { numero: 4, celdas: [""] },
      { numero: 5, celdas: ["1", "2"] },
    ]);
  });

  it("numera registros, no líneas físicas: un salto dentro de comillas no suma", () => {
    expect(numeros('h\n"x\ny"\n\n2\n')).toEqual([1, 2, 4]);
  });

  it("al final se siguen quitando los registros en blanco, incluidos «,,,», «   » y «\"\"» (como antes)", () => {
    expect(celdas('h\n1\n,,,\n   \n""\n\n')).toEqual([["h"], ["1"]]);
    expect(numeros("h\n\n1\n\n\n")).toEqual([1, 3]);
  });

  it("un archivo de solo líneas vacías no tiene registros", () => {
    expect(leerCsv("\n\n\r\n\r")).toEqual([]);
  });
});
