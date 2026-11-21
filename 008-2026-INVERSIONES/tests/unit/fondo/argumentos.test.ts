// Lectura de los argumentos de scripts/actualizar-fondo.ts. Datos inventados.
import { describe, expect, it } from "vitest";
import { DIAS_POR_DEFECTO, interpretarArgumentos } from "@/fondo/argumentos";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
// 2024-03-12 15:00 UTC = 10:00 en Colombia.
const AHORA = new Date("2024-03-12T15:00:00Z");

describe("interpretarArgumentos · actualizar", () => {
  it(`sin argumentos trae los últimos ${DIAS_POR_DEFECTO} días hasta hoy en Bogotá`, () => {
    expect(interpretarArgumentos([], AHORA)).toEqual({ ok: true, modo: "actualizar", desde: dia("2024-03-02"), hasta: dia("2024-03-12") });
  });

  it("a las 22:30 en Colombia sigue siendo el mismo día, aunque en UTC ya sea el siguiente", () => {
    const r = interpretarArgumentos([], new Date("2024-03-13T03:30:00Z"));
    expect(r.ok && r.modo === "actualizar" && r.hasta).toEqual(dia("2024-03-12"));
  });

  it("acepta --desde y --hasta", () => {
    expect(interpretarArgumentos(["--desde", "2024-03-01", "--hasta", "2024-03-05"], AHORA)).toEqual({ ok: true, modo: "actualizar", desde: dia("2024-03-01"), hasta: dia("2024-03-05") });
  });

  it.each([
    [["--desde", "2024-03-12", "--hasta", "2024-03-01"], "rango", "RANGO_INVALIDO"],
    [["--desde", "2024-02-30"], "desde", "FECHA_INVALIDA"],
    [["--hasta", "12/03/2024"], "hasta", "FECHA_FORMATO"],
    [["--otra"], "argumentos", "ARGUMENTOS_INVALIDOS"],
    [["suelto"], "argumentos", "ARGUMENTOS_INVALIDOS"],
    [["--codigo", "999001"], "argumentos", "ARGUMENTOS_INVALIDOS"],
  ])("rechaza %j", (args, campo, codigo) => {
    expect(interpretarArgumentos(args, AHORA)).toEqual({ ok: false, errores: [{ campo, codigo }] });
  });
});

describe("interpretarArgumentos · registrar", () => {
  it("lee el código, la clase y el nombre del fondo", () => {
    expect(interpretarArgumentos(["--registrar", "--codigo", "999001", "--participacion", "901", "--nombre", "Fondo ficticio"], AHORA)).toEqual({
      ok: true,
      modo: "registrar",
      datos: { codigo: "999001", participacion: "901", nombre: "Fondo ficticio" },
      hoy: dia("2024-03-12"),
    });
  });

  it("la clase es opcional", () => {
    const r = interpretarArgumentos(["--registrar", "--codigo", "999001", "--nombre", "Fondo ficticio"], AHORA);
    expect(r.ok && r.modo === "registrar" && r.datos.participacion).toBeNull();
  });

  it("devuelve todos los campos inválidos a la vez", () => {
    expect(interpretarArgumentos(["--registrar", "--codigo", "abc"], AHORA)).toEqual({
      ok: false,
      errores: [{ campo: "codigo", codigo: "CODIGO_FIC_FORMATO" }, { campo: "nombre", codigo: "NOMBRE_FORMATO" }],
    });
  });

  it("no mezcla el registro con el rango de fechas", () => {
    expect(interpretarArgumentos(["--registrar", "--codigo", "999001", "--nombre", "F", "--desde", "2024-03-01"], AHORA)).toEqual({ ok: false, errores: [{ campo: "argumentos", codigo: "ARGUMENTOS_INVALIDOS" }] });
  });
});
