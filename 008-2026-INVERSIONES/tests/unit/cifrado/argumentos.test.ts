// Argumentos de scripts/cifrar-existentes.ts (#11): por defecto es un ensayo; escribir exige nombrar la base.
import { describe, expect, it } from "vitest";
import { ErrorArgumentos, LOTE_POR_DEFECTO, leerArgumentos, USO } from "@/cifrado/argumentos";

describe("leerArgumentos", () => {
  it("sin argumentos: ensayo, sin escribir, con el lote por defecto", () => {
    expect(leerArgumentos([])).toEqual({ aplicar: false, reCifrar: false, base: undefined, lote: LOTE_POR_DEFECTO });
  });

  it("--aplicar con --base: cifra lo que está en claro", () => {
    expect(leerArgumentos(["--aplicar", "--base", "inversiones_x"])).toMatchObject({ aplicar: true, reCifrar: false, base: "inversiones_x" });
  });

  it("--re-cifrar con --base: pasa los sobres de otra versión a la activa; se puede junto con --aplicar", () => {
    expect(leerArgumentos(["--re-cifrar", "--base", "b_test"])).toMatchObject({ aplicar: false, reCifrar: true, base: "b_test" });
    expect(leerArgumentos(["--base", "b_test", "--aplicar", "--re-cifrar"])).toMatchObject({ aplicar: true, reCifrar: true });
  });

  it("--lote acepta un entero entre 1 y 5000", () => {
    expect(leerArgumentos(["--lote", "200"]).lote).toBe(200);
  });

  it.each([
    ["--aplicar sin --base", ["--aplicar"]],
    ["--re-cifrar sin --base", ["--re-cifrar"]],
    ["--base sin valor", ["--aplicar", "--base"]],
    ["--base seguido de otra opción", ["--base", "--aplicar"]],
    ["--base con caracteres no permitidos", ["--aplicar", "--base", "inversiones; DROP"]],
    ["--lote cero", ["--lote", "0"]],
    ["--lote no numérico", ["--lote", "mucho"]],
    ["--lote demasiado grande", ["--lote", "100000"]],
    ["--lote con decimales", ["--lote", "1.5"]],
    ["opción desconocida", ["--forzar"]],
    ["argumento suelto", ["inversiones"]],
    ["opción repetida", ["--aplicar", "--aplicar", "--base", "b"]],
  ])("rechaza %s con un error de uso", (_caso, argv) => {
    expect(() => leerArgumentos(argv)).toThrow(ErrorArgumentos);
  });
});

describe("ayuda del script", () => {
  it("dice que se corre dos veces (la segunda da 0 cambios), con los importadores detenidos, y recomienda VACUUM (ANALYZE)", () => {
    expect(USO).toMatch(/dos veces/);
    expect(USO).toMatch(/0 cambios/);
    expect(USO).toMatch(/importadores detenidos/);
    expect(USO).toMatch(/VACUUM \(ANALYZE\) fila_fuente/);
  });
});
