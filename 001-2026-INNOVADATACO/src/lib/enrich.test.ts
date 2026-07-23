import { describe, it, expect } from "vitest";
import {
  ENRIQUECIMIENTO_APAGADO,
  construirPrefijo,
  huellaEnriquecimiento,
  textoParaVectorizar,
  type ConfigEnriquecimiento,
} from "./enrich";

const DOC = {
  id: "SuperTransporte_Circular_114_de_2025",
  tipo: "circular",
  numero: "114",
  anio: 2025,
  entidad: "Superintendencia de Transporte",
  fecha: "2025-03-10",
};

describe("enrich — apagado por defecto (spec 003, D-031, SC-021)", () => {
  it("con la config por defecto el prefijo es vacío", () => {
    expect(construirPrefijo(DOC, ENRIQUECIMIENTO_APAGADO)).toBe("");
  });

  it("con el prefijo apagado el texto vectorizado es idéntico al contenido", () => {
    const contenido = "ARTÍCULO 1. Contenido del acto.";
    const prefijo = construirPrefijo(DOC, ENRIQUECIMIENTO_APAGADO);
    expect(textoParaVectorizar(contenido, prefijo)).toBe(contenido);
  });

  it("la huella por defecto es 'none'", () => {
    expect(huellaEnriquecimiento(ENRIQUECIMIENTO_APAGADO)).toBe("none");
  });
});

describe("enrich — prefijo activado (FR-026)", () => {
  const cfg: ConfigEnriquecimiento = {
    aplicar: true,
    campos: ["tipo", "numero", "anio", "entidad", "fecha"],
  };

  it("construye un prefijo determinista con los campos de negocio", () => {
    expect(construirPrefijo(DOC, cfg)).toBe(
      "[circular · 114 · 2025 · Superintendencia de Transporte · 2025-03-10]",
    );
  });

  it("antepone el prefijo solo al texto que se vectoriza", () => {
    const contenido = "ARTÍCULO 1. Contenido.";
    const texto = textoParaVectorizar(contenido, construirPrefijo(DOC, cfg));
    expect(texto.startsWith("[circular · 114")).toBe(true);
    expect(texto.endsWith(contenido)).toBe(true);
  });

  it("omite campos ausentes sin romper el prefijo", () => {
    const parcial = { tipo: "decreto", numero: null, anio: 1995, entidad: "", fecha: null };
    expect(construirPrefijo(parcial, cfg)).toBe("[decreto · 1995]");
  });

  it("la huella es estable e independiente del orden en que se listen los campos", () => {
    const a: ConfigEnriquecimiento = { aplicar: true, campos: ["numero", "tipo"] };
    const b: ConfigEnriquecimiento = { aplicar: true, campos: ["tipo", "numero"] };
    expect(huellaEnriquecimiento(a)).toBe(huellaEnriquecimiento(b));
    expect(huellaEnriquecimiento(a)).toBe("campos:tipo,numero");
  });
});

describe("enrich — NO reintroduce la fuga de etiqueta (FR-028, D-032)", () => {
  it("el id/nombre de archivo del documento nunca aparece en el texto vectorizado", () => {
    const cfg: ConfigEnriquecimiento = {
      aplicar: true,
      campos: ["tipo", "numero", "anio", "entidad", "fecha"],
    };
    const contenido = "ARTÍCULO 1. Contenido del acto.";
    const texto = textoParaVectorizar(contenido, construirPrefijo(DOC, cfg));
    // El defecto de scripts/eval-embeddings/lib/enrich.mjs:62 era anteponer doc.id.
    expect(texto).not.toContain(DOC.id);
    expect(texto).not.toContain("SuperTransporte_Circular");
  });

  it("'titulo' no es un campo admitido del prefijo", () => {
    // @ts-expect-error titulo no pertenece a CampoEnriquecimiento (era la fuga)
    const cfg: ConfigEnriquecimiento = { aplicar: true, campos: ["titulo"] };
    expect(huellaEnriquecimiento(cfg)).toBe("none");
  });
});
