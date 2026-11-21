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

  it("acepta tildes, eñes y signos comunes en el nombre", () => {
    expect(validarRegistroFondo({ codigo: "999001", nombre: "Fondo ficticio ñandú · inmobiliario (FIC) – 2024" }).ok).toBe(true);
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
    // security-reviewer BAJO: controles C1 (U+0085), de formato (bidi U+202E, U+200B, U+2066, BOM) y separadores de
    // línea o párrafo (U+2028, U+2029): son caracteres de control o invisibles que confunden pantallas y reportes.
    [{ codigo: "999001", nombre: "Fondo\u0085ficticio" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo \u202eoicitcif" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo\u200bficticio" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo \u2066ficticio" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "\ufeffFondo ficticio" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo\u2028ficticio" }, "nombre", "NOMBRE_FORMATO"],
    [{ codigo: "999001", nombre: "Fondo\u2029ficticio" }, "nombre", "NOMBRE_FORMATO"],
  ])("rechaza %j", (entrada, campo, codigo) => {
    expect(validarRegistroFondo(entrada)).toEqual({ ok: false, errores: [{ campo, codigo }] });
  });
});
