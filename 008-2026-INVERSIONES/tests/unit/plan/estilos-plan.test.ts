/**
 * Estilos de /plan y /decisiones: la hoja se puede cargar con otras rutas, así que cada regla va dentro de `.plan`
 * (el contenido) o de `.plan-top` (su encabezado) y no toca clases genéricas de otras pantallas.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const selectores = (css: string): string[] =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim())).filter((s) => s !== "" && !s.startsWith("@"));

describe("plan.css", () => {
  const lista = selectores(readFileSync(new URL("../../../src/app/_plan/plan.css", import.meta.url), "utf8"));

  it("lee las reglas (si no, no probaría nada)", () => {
    expect(lista.length).toBeGreaterThan(5);
  });

  it("toda regla va dentro de .plan o .plan-top", () => {
    for (const s of lista) expect(s, s).toMatch(/^\.plan(-top)?[\s.:[>]/);
  });
});
