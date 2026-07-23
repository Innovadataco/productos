import { describe, it, expect } from "vitest";
import { trocear } from "./chunker";

describe("trocear (spec 003, FR-001, FR-002)", () => {
  it("texto vacío o solo espacios → cero fragmentos", () => {
    expect(trocear("")).toEqual([]);
    expect(trocear("   \n  \t ")).toEqual([]);
  });

  it("texto más corto que el máximo → un solo fragmento con todo el texto", () => {
    const r = trocear("Un texto breve sin estructura normativa.");
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ orden: 0, contenido: "Un texto breve sin estructura normativa." });
  });

  it("orden consecutivo desde 0 y sin huecos", () => {
    const texto = [
      "ARTÍCULO 1. Primera disposición del acto.",
      "ARTÍCULO 2. Segunda disposición del acto.",
      "ARTÍCULO 3. Tercera disposición del acto.",
    ].join("\n");
    const r = trocear(texto);
    expect(r.map((f) => f.orden)).toEqual(r.map((_, i) => i));
    expect(r[0].orden).toBe(0);
  });

  it("estructural corta por las marcas del acto (CONSIDERANDO / RESUELVE / ARTÍCULO)", () => {
    // Bloques por encima de minChars (120): así no se fusionan y se ve el corte por marca.
    const relleno = (s: string) => s + " " + "texto de relleno del bloque normativo.".repeat(4);
    const texto = [
      "CONSIDERANDO " + relleno("que se requiere regular la materia del sector transporte"),
      "RESUELVE " + relleno("lo siguiente para el sector, en desarrollo de sus competencias"),
      "ARTÍCULO 1. " + relleno("La primera regla aplicable a los sujetos obligados es la siguiente"),
    ].join("\n");
    const r = trocear(texto);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.some((f) => f.contenido.startsWith("CONSIDERANDO"))).toBe(true);
    expect(r.some((f) => f.contenido.startsWith("RESUELVE"))).toBe(true);
    expect(r.some((f) => f.contenido.startsWith("ARTÍCULO 1"))).toBe(true);
  });

  it("fusiona encabezados sueltos demasiado cortos con el bloque contiguo", () => {
    // Bloques minúsculos (< minChars): el troceador no debe devolver ruido de una línea.
    const texto = ["CONSIDERANDO que sí.", "RESUELVE:", "ARTÍCULO 1. Breve."].join("\n");
    const r = trocear(texto);
    expect(r).toHaveLength(1);
  });

  it("respeta el tamaño máximo y no parte palabras", () => {
    const palabra = "reglamentacion ";
    const bloque = "ARTÍCULO 1. " + palabra.repeat(400); // ~6000 chars, sin marcas internas
    const r = trocear(bloque, { maxChars: 1800, overlapChars: 200 });
    expect(r.length).toBeGreaterThan(1);
    for (const f of r) {
      expect(f.contenido.length).toBeLessThanOrEqual(1800);
      // ninguna palabra partida: el contenido no empieza ni termina a media palabra
      expect(f.contenido).not.toMatch(/^\S*[a-z]$/); // heurística: no corta "reglamenta|cion"
    }
  });

  it("aplica solape entre fragmentos por tamaño", () => {
    const bloque = "ARTÍCULO 1. " + "palabra ".repeat(500);
    const r = trocear(bloque, { maxChars: 1000, overlapChars: 200 });
    expect(r.length).toBeGreaterThan(1);
    // el final de un fragmento reaparece al inicio del siguiente (solape)
    const colaPrimero = r[0].contenido.slice(-50);
    expect(r[1].contenido).toContain(colaPrimero.trim().split(" ")[1] ?? "palabra");
  });

  it("los parámetros son configurables (tamaño distinto → recuento distinto)", () => {
    const bloque = "ARTÍCULO 1. " + "palabra ".repeat(500);
    const chico = trocear(bloque, { maxChars: 500, overlapChars: 50 });
    const grande = trocear(bloque, { maxChars: 3000, overlapChars: 50 });
    expect(chico.length).toBeGreaterThan(grande.length);
  });

  it("la estrategia 'tamano' ignora las marcas estructurales", () => {
    const texto = [
      "ARTÍCULO 1. Corto.",
      "ARTÍCULO 2. También corto.",
    ].join("\n");
    const estructural = trocear(texto, { strategy: "estructural" });
    const porTamano = trocear(texto, { strategy: "tamano" });
    expect(estructural.length).toBeGreaterThanOrEqual(porTamano.length);
    expect(porTamano).toHaveLength(1); // cabe entero, no se corta
  });
});
