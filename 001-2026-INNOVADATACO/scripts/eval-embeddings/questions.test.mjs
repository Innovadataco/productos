import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { construirPrefijo } from "./lib/enrich.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const banco = JSON.parse(readFileSync(join(DIR, "questions.json"), "utf8"));

/**
 * Verifica que la fuga de etiqueta de D-032 quedó cerrada (spec 003, FR-028,
 * SC-024). Corre sin corpus ni inferencia.
 */
describe("banco de evaluación — sin fuga de etiqueta (SC-024)", () => {
  it("documentoEsperado es un id OPACO (DOC-NN), no el nombre del archivo", () => {
    for (const q of banco.preguntas) {
      expect(q.documentoEsperado).toMatch(/^DOC-\d{2}$/);
    }
  });

  it("cada documentoEsperado existe en el mapa de documentos", () => {
    for (const q of banco.preguntas) {
      expect(banco.documentos[q.documentoEsperado]).toBeDefined();
    }
  });

  it("el prefijo de enriquecimiento NO contiene el id del documento (la etiqueta)", () => {
    const campos = ["tipo", "numero", "anio", "entidad", "fecha", "titulo"];
    for (const [id, info] of Object.entries(banco.documentos)) {
      // Documento como lo ve el runner: id opaco + título aparte + metadatos.
      const doc = { id, titulo: info.titulo, tipo: "circular", numero: "114", entidad: "X", fecha: "2025-01-01", anio: "2025" };
      const prefijo = construirPrefijo(doc, campos);
      // El id opaco (= documentoEsperado) NUNCA debe aparecer en el texto que se rankea.
      expect(prefijo).not.toContain(id);
    }
  });

  it("el título usado en el prefijo es el campo aparte, no el id", () => {
    const doc = { id: "DOC-01", titulo: "3476", tipo: "resolucion", numero: "1", entidad: "X", fecha: "2020-01-01" };
    const prefijo = construirPrefijo(doc, ["titulo"]);
    expect(prefijo).toContain("3476"); // título realista (campo aparte)
    expect(prefijo).not.toContain("DOC-01"); // no la etiqueta
  });
});
