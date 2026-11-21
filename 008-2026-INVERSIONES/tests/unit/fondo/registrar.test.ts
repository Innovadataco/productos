// Validación de los datos para registrar el fondo. Datos inventados.
import { describe, expect, it } from "vitest";
import { validarRegistroFondo } from "@/fondo/registrar";

describe("validarRegistroFondo", () => {
  it("acepta código y clase en dígitos y recorta el nombre", () => {
    expect(validarRegistroFondo({ codigo: "999001", participacion: "901", nombre: "  Fondo ficticio  " })).toEqual({
      ok: true,
      valor: { codigo: "999001", participacion: "901", nombre: "Fondo ficticio" },
    });
  });

  it("sin clase, queda en null", () => {
    const r = validarRegistroFondo({ codigo: "999001", nombre: "Fondo ficticio" });
    expect(r.ok && r.valor.participacion).toBeNull();
  });

  it.each([
    [{ codigo: "99-01", nombre: "F" }, "codigo", "CODIGO_FIC_FORMATO"],
    [{ codigo: "1".repeat(13), nombre: "F" }, "codigo", "CODIGO_FIC_FORMATO"],
    [{ nombre: "F" }, "codigo", "CODIGO_FIC_FORMATO"],
    [{ codigo: "999001", participacion: "1234567", nombre: "F" }, "participacion", "PARTICIPACION_FORMATO"],
    [{ codigo: "999001", participacion: "", nombre: "F" }, "participacion", "PARTICIPACION_FORMATO"],
    [{ codigo: "999001", nombre: "   " }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "x".repeat(121) }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo\nficticio" }, "nombre", "NOMBRE_FORMATO"],
  ])("rechaza %j", (entrada, campo, codigo) => {
    expect(validarRegistroFondo(entrada)).toEqual({ ok: false, errores: [{ campo, codigo }] });
  });
});
