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
    expect(leerCsv("a,b,c\n2026-10-19,,5\n")).toEqual([["a", "b", "c"], ["2026-10-19", "", "5"]]);
  });

  it("falla si una comilla queda sin cerrar", () => {
    expect(() => leerCsv('a\n"abierta\n')).toThrow(ErrorCsv);
  });
});
