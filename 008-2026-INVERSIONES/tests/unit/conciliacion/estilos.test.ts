/**
 * Estilos de /conciliacion (react-reviewer MEDIO): la hoja se puede cargar con otras rutas, así que cada regla va
 * dentro de `.concilia` (el contenido) o de `.concilia-top` (su encabezado) y no toca clases genéricas de otras
 * pantallas. Los enlaces de notas del tablero sí van en tablero.css (react-reviewer ALTO: contraste).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) => readFileSync(new URL(`../../../src/app/${ruta}`, import.meta.url), "utf8");
/** Los selectores de cada regla, sin comentarios ni @media. */
const selectores = (css: string): string[] =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim())).filter((s) => s !== "" && !s.startsWith("@"));

describe("conciliacion.css", () => {
  const lista = selectores(leer("conciliacion/conciliacion.css"));

  it("lee las reglas (si no, no probaría nada)", () => {
    expect(lista.length).toBeGreaterThan(10);
  });

  it("toda regla va dentro de .concilia o .concilia-top", () => {
    for (const s of lista) expect(s, s).toMatch(/^\.concilia(-top)?[\s.:[]/);
  });
});

describe("tablero.css", () => {
  it("los enlaces de las notas y de «Lo que todavía no está» tienen el color de la marca, no el del navegador", () => {
    const lista = selectores(leer("tablero/tablero.css"));
    expect(lista).toEqual(expect.arrayContaining([".nota a", ".falta a"]));
  });
});
