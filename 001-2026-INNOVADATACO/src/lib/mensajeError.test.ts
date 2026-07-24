import { describe, it, expect } from "vitest";
import { mensajeDeError } from "./mensajeError";

describe("mensajeDeError (spec 009, FR-002)", () => {
  it("devuelve el mensaje del Error, que es el texto legible que lanzó la pantalla", () => {
    expect(mensajeDeError(new Error("Error al cargar oportunidades"))).toBe(
      "Error al cargar oportunidades",
    );
  });

  it("acepta un string lanzado tal cual", () => {
    expect(mensajeDeError("Credenciales inválidas")).toBe("Credenciales inválidas");
  });

  it("usa el mensaje por defecto ante un Error sin texto", () => {
    expect(mensajeDeError(new Error(""), "No se pudo guardar")).toBe("No se pudo guardar");
  });

  it("usa el mensaje por defecto ante cualquier cosa que no sea Error ni string", () => {
    expect(mensajeDeError({ codigo: 500 }, "Fallo inesperado")).toBe("Fallo inesperado");
    expect(mensajeDeError(null, "Fallo inesperado")).toBe("Fallo inesperado");
    expect(mensajeDeError(undefined)).toBe("Error desconocido");
  });
});
