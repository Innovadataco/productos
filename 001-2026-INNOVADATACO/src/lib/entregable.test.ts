import { describe, it, expect } from "vitest";
import { validarEntregable, datosEntregable } from "./entregable";

describe("validarEntregable (spec 008, FR-010)", () => {
  it("acepta un entregable con sus cinco campos", () => {
    expect(
      validarEntregable({
        nombre: "Informe final",
        descripcion: "Documento de cierre",
        avance: 50,
        estado: "en curso",
        fechaCompromiso: "2026-09-30",
        responsable: "Ana",
      }),
    ).toBeNull();
  });

  it("acepta lo mínimo: solo el nombre", () => {
    expect(validarEntregable({ nombre: "Acta" })).toBeNull();
  });

  it("rechaza un entregable sin nombre, con mensaje legible (US3-3)", () => {
    for (const cuerpo of [{}, { nombre: "" }, { nombre: "   " }, { nombre: 7 }]) {
      expect(validarEntregable(cuerpo)).toBe("El nombre del entregable es obligatorio");
    }
  });

  it("rechaza un avance fuera de 0-100", () => {
    expect(validarEntregable({ nombre: "X", avance: 101 })).toContain("entre 0 y 100");
    expect(validarEntregable({ nombre: "X", avance: -1 })).toContain("entre 0 y 100");
    expect(validarEntregable({ nombre: "X", avance: "mucho" })).toContain("entre 0 y 100");
  });

  it("acepta los extremos del avance", () => {
    expect(validarEntregable({ nombre: "X", avance: 0 })).toBeNull();
    expect(validarEntregable({ nombre: "X", avance: 100 })).toBeNull();
  });

  it("rechaza un estado que no está en el catálogo", () => {
    expect(validarEntregable({ nombre: "X", estado: "inventado" })).toContain("Estado no válido");
  });

  it("rechaza una fecha de compromiso que no es fecha", () => {
    expect(validarEntregable({ nombre: "X", fechaCompromiso: "el mes que viene" })).toContain(
      "no es una fecha válida",
    );
  });
});

describe("datosEntregable (spec 008, US3)", () => {
  it("aplica los valores por defecto de lo que no llega", () => {
    expect(datosEntregable({ nombre: "  Acta  " })).toEqual({
      nombre: "Acta",
      descripcion: "",
      avance: 0,
      estado: "pendiente",
      fechaInicio: null,
      fechaCompromiso: null,
      responsable: "",
      dependeDe: null,
    });
  });

  it("convierte fechaInicio (spec 015) y rechaza un fin anterior al inicio", () => {
    const datos = datosEntregable({
      nombre: "Informe",
      fechaInicio: "2026-09-01",
      fechaCompromiso: "2026-09-30",
    });
    expect(datos.fechaInicio?.toISOString().slice(0, 10)).toBe("2026-09-01");

    // La validación no deja un compromiso anterior al inicio.
    expect(
      validarEntregable({ nombre: "X", fechaInicio: "2026-09-30", fechaCompromiso: "2026-09-01" }),
    ).toContain("no puede ser anterior");
  });

  it("convierte la fecha de compromiso y redondea el avance", () => {
    const datos = datosEntregable({ nombre: "Informe", fechaCompromiso: "2026-09-30", avance: "75" });

    expect(datos.fechaCompromiso).toBeInstanceOf(Date);
    expect(datos.fechaCompromiso?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(datos.avance).toBe(75);
  });

  it("una fecha vacía queda en null, no en fecha inválida", () => {
    expect(datosEntregable({ nombre: "X", fechaCompromiso: "" }).fechaCompromiso).toBeNull();
  });
});
