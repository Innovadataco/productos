/**
 * La lista cerrada de modelos aprobados de la puerta local, con el módulo REAL (sin mocks). El único aprobado es
 * `ornith:9b`, el modelo que PI tiene en el Mac; nada de 32B. Su digest queda pendiente (null) hasta medirlo en el
 * Mac (E7): no se inventa. Poner el digest es un cambio auditable que cambia esta prueba.
 */
import { describe, expect, it } from "vitest";
import { PATRON_MODELO } from "@/ia/generador";
import { MODELOS_APROBADOS, PATRON_DIGEST, modeloAprobado } from "@/ia/local/modelos";

describe("MODELOS_APROBADOS", () => {
  it("es exactamente ornith:9b, con el digest por verificar", () => {
    expect(MODELOS_APROBADOS).toEqual([{ nombre: "ornith:9b", digest: null }]);
  });

  it("está congelada, también cada entrada", () => {
    expect(Object.isFrozen(MODELOS_APROBADOS)).toBe(true);
    for (const modelo of MODELOS_APROBADOS) expect(Object.isFrozen(modelo)).toBe(true);
  });

  it("cada nombre cumple el patrón del contrato, sin repetirse, y cada digest es null o 64 hex", () => {
    const nombres = MODELOS_APROBADOS.map((m) => m.nombre);
    for (const { nombre, digest } of MODELOS_APROBADOS) {
      expect(nombre).toMatch(PATRON_MODELO);
      if (digest !== null) expect(digest).toMatch(PATRON_DIGEST);
    }
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("ningún aprobado es de 32B (condición 3 de PI)", () => {
    expect(MODELOS_APROBADOS.some((m) => /32b/i.test(m.nombre))).toBe(false);
  });
});

describe("modeloAprobado", () => {
  it("devuelve la entrada del nombre exacto", () => {
    expect(modeloAprobado("ornith:9b")).toBe(MODELOS_APROBADOS[0]);
  });

  it.each(["ornith:32b", "ORNITH:9B", "ornith:9b ", " ornith:9b", "ornith", "ornith:latest", "qwen2.5:14b", "", undefined, null, 9])("«%s» no está aprobado", (nombre) => {
    expect(modeloAprobado(nombre)).toBeNull();
  });
});

describe("PATRON_DIGEST", () => {
  const hex = "4613a27c".repeat(8);

  it("acepta 64 hex en minúsculas", () => {
    expect(PATRON_DIGEST.test(hex)).toBe(true);
  });

  it.each([hex.toUpperCase(), hex.slice(1), `${hex}a`, `sha256:${hex}`, `${hex}\n`, ""])("rechaza «%s»", (texto) => {
    expect(PATRON_DIGEST.test(texto)).toBe(false);
  });
});
