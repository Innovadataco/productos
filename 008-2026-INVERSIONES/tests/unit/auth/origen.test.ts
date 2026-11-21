// CSRF por Origin (D-014): todo método que no sea GET o HEAD exige un Origin de la lista permitida.
// En producción la lista es APP_ORIGEN (obligatoria); en desarrollo, la app local en el 5008.
import { describe, expect, it } from "vitest";
import { ORIGENES_DESARROLLO, origenValido, origenesPermitidos } from "@/auth/origen";

const PROD = "https://inversiones.innovadataco.com";
const cab = (datos: Record<string, string>) => new Headers(datos);

describe("origenesPermitidos", () => {
  it("en producción es solo APP_ORIGEN", () => {
    expect(origenesPermitidos({ NODE_ENV: "production", APP_ORIGEN: PROD })).toEqual([PROD]);
  });

  it("en producción sin APP_ORIGEN, o con uno inválido, falla (falla cerrada)", () => {
    expect(() => origenesPermitidos({ NODE_ENV: "production" })).toThrow(/APP_ORIGEN/);
    for (const malo of ["http://inversiones.innovadataco.com", `${PROD}/`, `${PROD}/ingresar`, "inversiones.innovadataco.com", "*"]) {
      expect(() => origenesPermitidos({ NODE_ENV: "production", APP_ORIGEN: malo }), malo).toThrow(/APP_ORIGEN/);
    }
  });

  it("fuera de producción es la app local en el 5008 (http con `dev`, https con `dev:https`)", () => {
    expect(origenesPermitidos({ NODE_ENV: "development" })).toEqual(ORIGENES_DESARROLLO);
    expect(ORIGENES_DESARROLLO).toEqual(["http://127.0.0.1:5008", "http://localhost:5008", "https://127.0.0.1:5008", "https://localhost:5008"]);
  });
});

describe("origenValido", () => {
  const permitidos = [PROD];

  it("GET y HEAD no lo necesitan", () => {
    expect(origenValido("GET", cab({}), permitidos)).toBe(true);
    expect(origenValido("HEAD", cab({}), permitidos)).toBe(true);
  });

  it("un POST con el Origin permitido pasa", () => {
    expect(origenValido("POST", cab({ origin: PROD }), permitidos)).toBe(true);
    expect(origenValido("POST", cab({ origin: PROD, "sec-fetch-site": "same-origin" }), permitidos)).toBe(true);
  });

  it.each([
    ["sin Origin", {}],
    ["Origin «null»", { origin: "null" }],
    ["otro sitio", { origin: "https://atacante.example" }],
    ["subdominio parecido", { origin: "https://inversiones.innovadataco.com.atacante.example" }],
    ["mismo host por http", { origin: "http://inversiones.innovadataco.com" }],
    ["Sec-Fetch-Site cross-site", { origin: PROD, "sec-fetch-site": "cross-site" }],
  ])("un POST %s se rechaza", (_caso, cabeceras) => {
    expect(origenValido("POST", cab(cabeceras), permitidos)).toBe(false);
  });

  it("PUT, PATCH, DELETE y OPTIONS también lo exigen", () => {
    for (const metodo of ["PUT", "PATCH", "DELETE", "OPTIONS"]) expect(origenValido(metodo, cab({}), permitidos), metodo).toBe(false);
  });
});
