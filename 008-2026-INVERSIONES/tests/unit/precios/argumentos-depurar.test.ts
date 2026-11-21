// Argumentos de scripts/depurar-precios.ts (SPEC-13): por defecto es un ensayo; escribir exige nombrar la base.
import { describe, expect, it } from "vitest";
import { ErrorArgumentosDepurar, leerArgumentosDepurar, USO_DEPURAR } from "@/precios/argumentos-depurar";

const HOY = new Date("2026-11-21T00:00:00Z");
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("leerArgumentosDepurar", () => {
  it("con --desde: ensayo hasta hoy, sin escribir", () => {
    expect(leerArgumentosDepurar(["--desde", "2025-04-01"], HOY)).toEqual({ desde: utc("2025-04-01"), hasta: HOY, aplicar: false, base: undefined });
  });

  it("--hasta acota el rango; --aplicar con --base escribe", () => {
    expect(leerArgumentosDepurar(["--desde", "2025-04-01", "--hasta", "2025-06-30", "--aplicar", "--base", "inversiones_x"], HOY)).toEqual({
      desde: utc("2025-04-01"), hasta: utc("2025-06-30"), aplicar: true, base: "inversiones_x",
    });
  });

  it.each([
    ["sin --desde", []],
    ["--desde sin valor", ["--desde"]],
    ["--desde seguido de otra opción", ["--desde", "--aplicar"]],
    ["--desde con otro formato", ["--desde", "01/04/2025"]],
    ["--desde inválida", ["--desde", "2025-02-30"]],
    ["--hasta antes de --desde", ["--desde", "2025-04-02", "--hasta", "2025-04-01"]],
    ["--hasta después de hoy", ["--desde", "2025-04-01", "--hasta", "2026-11-22"]],
    ["--aplicar sin --base", ["--desde", "2025-04-01", "--aplicar"]],
    ["--base con caracteres no permitidos", ["--desde", "2025-04-01", "--aplicar", "--base", "inversiones; DROP"]],
    ["opción desconocida", ["--desde", "2025-04-01", "--forzar"]],
    ["argumento suelto", ["--desde", "2025-04-01", "inversiones"]],
    ["opción repetida", ["--desde", "2025-04-01", "--desde", "2025-04-02"]],
  ])("rechaza %s con un error de uso", (_caso, argv) => {
    expect(() => leerArgumentosDepurar(argv, HOY)).toThrow(ErrorArgumentosDepurar);
  });
});

describe("ayuda del script", () => {
  it("dice que sin --aplicar es un ensayo, que se aplica después del arreglo desplegado y que se corre dos veces", () => {
    expect(USO_DEPURAR).toMatch(/ensayo/);
    expect(USO_DEPURAR).toMatch(/--aplicar --base/);
    expect(USO_DEPURAR).toMatch(/dos veces/);
    expect(USO_DEPURAR).toMatch(/desplegado/);
  });
});
