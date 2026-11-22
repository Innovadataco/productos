// Estilos de /datos-oficiales (frente datos-oficiales-pantalla, C6a): claro y oscuro salen de los tokens del tablero
// (ningún color fijo en la hoja), el estado de la frescura no se dice solo con color (tiene texto y, en alto contraste,
// borde), «Ver los datos» mide 44 px para el dedo, a 375 px nada se sale (las palabras largas de la fuente se parten) y
// la hoja no anima nada propio (el movimiento de la gráfica lo maneja el módulo común con «reducir movimiento»).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../../../src/app/datos-oficiales/datos-oficiales.css", import.meta.url)), "utf8");
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("datos-oficiales.css", () => {
  it("sin colores fijos: todo por los tokens (claro y oscuro los da tablero.css)", () => {
    expect(sinComentarios.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
    expect(sinComentarios).toMatch(/var\(--panel\)/);
  });

  it("todo queda dentro de la pantalla (.do o .do-*): no toca las otras", () => {
    const selectores = sinComentarios.replace(/@media[^{]*\{/g, "").split("}").map((b) => b.split("{")[0]!.trim()).filter(Boolean);
    expect(selectores.length).toBeGreaterThan(5);
    for (const sel of selectores) for (const parte of sel.split(",")) expect(parte.trim(), parte).toMatch(/^\.do\b/);
  });

  it("«Ver los datos» de cada gráfica mide al menos 44 px", () => {
    expect(sinComentarios).toMatch(/\.do \.g-datos summary\s*\{[^}]*min-height:\s*44px/);
  });

  it("a 375 px: la cuadrícula baja a una columna y el texto largo de la fuente se parte", () => {
    expect(sinComentarios).toMatch(/\.do-series\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(\d+px, 100%\), 1fr\)\)/);
    expect(sinComentarios).toMatch(/\.do-pares dd\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(sinComentarios).toMatch(/\.do-serie\s*\{[^}]*min-width:\s*0/);
  });

  it("el estado tiene borde (no solo color de fondo) y en alto contraste se sigue viendo", () => {
    expect(sinComentarios).toMatch(/\.do-estado\s*\{[^}]*border:\s*1px solid/);
    const bloque = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(bloque).toMatch(/\.do-estado\s*\{[^}]*border-color:\s*CanvasText/);
  });

  it("el foco no queda bajo el encabezado fijo (WCAG 2.4.11; revisión a11y-architect, ALTO): margen al desplazar, mayor en el celular", () => {
    const margen = (bloque: string) => Number(/\.do :is\(a, summary, \[tabindex\]\)\s*\{[^}]*scroll-margin-top:\s*(\d+)px/.exec(bloque)?.[1] ?? 0);
    const sinMedia = sinComentarios.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    const celular = /@media \(max-width: 620px\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(margen(sinMedia)).toBeGreaterThanOrEqual(96);
    expect(margen(celular)).toBeGreaterThan(margen(sinMedia));
  });

  it("el enlace de la fuente mide al menos 24 px de alto (WCAG 2.5.8) y el código de la fuente no baja de 12 px", () => {
    expect(sinComentarios).toMatch(/\.do-pares a\s*\{[^}]*display:\s*inline-block[^}]*padding-block:\s*[3-9]px/);
    expect(Number(/\.do-codigo\s*\{[^}]*font-size:\s*(\d+)px/.exec(sinComentarios)?.[1])).toBeGreaterThanOrEqual(12);
  });

  it("no anima nada propio", () => {
    expect(sinComentarios).not.toMatch(/\banimation\b|\btransition\b|@keyframes/);
  });
});
