import { describe, it, expect } from "vitest";
import {
  esquemaBusquedaDocumentos,
  esquemaAnalisisInvestigacion,
  validar,
  LIMITE_QUERY,
  LIMITE_PROMPT_IA,
} from "./esquemas";

describe("esquemaBusquedaDocumentos (spec 009, FR-008 / §2.6)", () => {
  it("acepta una consulta normal y conserva los filtros", () => {
    const r = validar(esquemaBusquedaDocumentos, {
      query: "decreto 1079",
      tipo: "decreto",
      sector: "transporte",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.query).toBe("decreto 1079");
      expect(r.datos.tipo).toBe("decreto");
    }
  });

  it("mantiene el mensaje que la ruta ya devolvía cuando falta la consulta", () => {
    for (const cuerpo of [{}, { query: "" }, { query: "   " }, { query: 42 }]) {
      const r = validar(esquemaBusquedaDocumentos, cuerpo);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensaje).toBe("Consulta requerida");
    }
  });

  it("aplica el tope de §2.6 que la ruta no tenía implementado", () => {
    const r = validar(esquemaBusquedaDocumentos, { query: "a".repeat(LIMITE_QUERY + 1) });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain(String(LIMITE_QUERY));
  });

  it("acepta justo el límite", () => {
    expect(validar(esquemaBusquedaDocumentos, { query: "a".repeat(LIMITE_QUERY) }).ok).toBe(true);
  });
});

describe("esquemaAnalisisInvestigacion (spec 009, FR-008 / §2.6)", () => {
  it("acepta un documentId solo", () => {
    expect(validar(esquemaAnalisisInvestigacion, { documentId: "doc1" }).ok).toBe(true);
  });

  it("acepta un texto pegado solo", () => {
    expect(validar(esquemaAnalisisInvestigacion, { text: "Un texto para analizar" }).ok).toBe(true);
  });

  it("exige uno de los dos, con el mensaje que la ruta ya devolvía", () => {
    const r = validar(esquemaAnalisisInvestigacion, {});

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toBe("documentId o text requerido");
  });

  it("aplica el tope de prompt de §2.6, que tampoco estaba implementado", () => {
    const r = validar(esquemaAnalisisInvestigacion, { text: "a".repeat(LIMITE_PROMPT_IA + 1) });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain(String(LIMITE_PROMPT_IA));
  });
});

describe("validar (spec 009, §0.3)", () => {
  it("nunca devuelve el error de Zod crudo, solo un mensaje legible", () => {
    const r = validar(esquemaBusquedaDocumentos, { query: "" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(typeof r.mensaje).toBe("string");
      expect(r.mensaje).not.toContain("ZodError");
      expect(r.mensaje).not.toContain("invalid_type");
    }
  });
});
