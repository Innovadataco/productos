import { describe, expect, it } from "vitest";
import { ErrorCsv, leerCsv } from "@/importacion/trii/csv";

describe("leerCsv", () => {
  it("lee comas dentro de comillas y comillas escapadas", () => {
    expect(leerCsv('a,b\n"1,5","dijo ""hola"""\n')).toEqual([["a", "b"], ["1,5", 'dijo "hola"']]);
  });

  it("quita el BOM UTF-8, acepta CRLF y descarta líneas vacías del final", () => {
    expect(leerCsv("﻿a,b\r\n1,2\r\n\r\n\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("acepta saltos de línea dentro de comillas", () => {
    expect(leerCsv('a\n"x\ny"\n')).toEqual([["a"], ["x\ny"]]);
  });

  it("conserva campos vacíos (el Estado de dividendos viene vacío)", () => {
    expect(leerCsv("a,b,c\n2024-10-17,,5\n")).toEqual([["a", "b", "c"], ["2024-10-17", "", "5"]]);
  });

  it("falla si una comilla queda sin cerrar", () => {
    expect(() => leerCsv('a\n"abierta\n')).toThrow(ErrorCsv);
  });
});

// Bordes del archivo (hueco de pruebas): vacío, solo encabezado, finales de línea y coma final.
describe("leerCsv · bordes del archivo", () => {
  it("un archivo vacío o con solo el BOM no tiene filas", () => {
    expect(leerCsv("")).toEqual([]);
    expect(leerCsv("\uFEFF")).toEqual([]);
    expect(leerCsv("\r\n\n")).toEqual([]);
  });

  it("solo el encabezado, con o sin salto final, es una sola fila", () => {
    for (const texto of ["a,b", "a,b\n", "a,b\r\n", "\uFEFFa,b\r\n"]) expect(leerCsv(texto), JSON.stringify(texto)).toEqual([["a", "b"]]);
  });

  it("un CRLF dentro de comillas es parte del campo", () => {
    expect(leerCsv('a\r\n"x\r\ny"\r\n')).toEqual([["a"], ["x\r\ny"]]);
  });

  it("un CR suelto (fin de línea antiguo) también separa filas", () => {
    expect(leerCsv("a,b\r1,2\r")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("una coma al final deja un último campo vacío, también en la última línea sin salto", () => {
    expect(leerCsv("a,b,\n1,2,")).toEqual([["a", "b", ""], ["1", "2", ""]]);
  });

  it("como lo entrega Trii: BOM, CRLF y la fecha con coma entre comillas", () => {
    expect(leerCsv('\uFEFFFecha y hora,Valor total\r\n"14 mar 2024, 3:27 p. m.",500000.0\r\n')).toEqual([
      ["Fecha y hora", "Valor total"],
      ["14 mar 2024, 3:27 p. m.", "500000.0"],
    ]);
  });
});
