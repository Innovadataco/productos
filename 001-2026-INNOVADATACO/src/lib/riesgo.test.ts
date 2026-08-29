import { describe, it, expect } from "vitest";
import {
  validarRiesgo,
  datosRiesgo,
  esRiesgoAbierto,
  PROBABILIDADES_RIESGO,
  IMPACTOS_RIESGO,
  ESTADOS_RIESGO,
} from "./riesgo";

describe("validarRiesgo (spec 014, FR-004)", () => {
  it("acepta un riesgo con sus cinco campos", () => {
    expect(
      validarRiesgo({
        descripcion: "El proveedor puede retrasarse",
        probabilidad: "alta",
        impacto: "alto",
        mitigacion: "Buscar un segundo proveedor",
        estado: "abierto",
      }),
    ).toBeNull();
  });

  it("acepta lo mínimo: solo la descripción", () => {
    expect(validarRiesgo({ descripcion: "Riesgo genérico" })).toBeNull();
  });

  it("exige descripción, con mensaje legible (US3-2)", () => {
    for (const cuerpo of [{}, { descripcion: "" }, { descripcion: "  " }, { descripcion: 7 }]) {
      expect(validarRiesgo(cuerpo)).toBe("La descripción del riesgo es obligatoria");
    }
  });

  it("acepta las tres probabilidades y rechaza otra (US3-3)", () => {
    for (const p of PROBABILIDADES_RIESGO) expect(validarRiesgo({ descripcion: "X", probabilidad: p })).toBeNull();
    expect(validarRiesgo({ descripcion: "X", probabilidad: "altísima" })).toContain("Probabilidad no válida");
  });

  it("acepta los tres impactos y rechaza otro", () => {
    for (const i of IMPACTOS_RIESGO) expect(validarRiesgo({ descripcion: "X", impacto: i })).toBeNull();
    expect(validarRiesgo({ descripcion: "X", impacto: "catastrófico" })).toContain("Impacto no válido");
  });

  it("acepta los tres estados y rechaza otro", () => {
    for (const e of ESTADOS_RIESGO) expect(validarRiesgo({ descripcion: "X", estado: e })).toBeNull();
    expect(validarRiesgo({ descripcion: "X", estado: "pendiente" })).toContain("Estado no válido");
  });
});

describe("datosRiesgo (spec 014)", () => {
  it("aplica los valores por defecto de lo que no llega", () => {
    expect(datosRiesgo({ descripcion: "  Riesgo  " })).toEqual({
      descripcion: "Riesgo",
      probabilidad: "media",
      impacto: "medio",
      mitigacion: "",
      estado: "abierto",
    });
  });
});

describe("esRiesgoAbierto (spec 014, FR-005)", () => {
  it("abierto y mitigado cuentan como abiertos; cerrado no", () => {
    expect(esRiesgoAbierto("abierto")).toBe(true);
    expect(esRiesgoAbierto("mitigado")).toBe(true);
    expect(esRiesgoAbierto("cerrado")).toBe(false);
  });
});
