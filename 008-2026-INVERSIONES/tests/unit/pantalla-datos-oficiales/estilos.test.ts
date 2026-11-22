// Estilos de /datos-oficiales (frente datos-oficiales-pantalla, C6a): claro y oscuro salen de los tokens del tablero
// (ningún color fijo en la hoja), el estado de la frescura no se dice solo con color (tiene texto y, en alto contraste,
// borde), «Ver los datos» mide 44 px para el dedo, a 375 px nada se sale (las palabras largas de la fuente se parten) y
// la hoja no anima nada propio (el movimiento de la gráfica lo maneja el módulo común con «reducir movimiento»).
// Las tablas de los decretos (frente datos-oficiales-decretos-pantalla, C6b): se desplazan dentro de su región con un
// ancho mínimo moderado (no el de 980 px del tablero), sin el cursor ni el resaltado de fila del tablero (aquí no se
// elige nada), el estado del cruce y la marca de la disputa con borde (también en alto contraste), el enlace de la
// referencia de al menos 24 px de alto y ninguna letra por debajo de 12 px.
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
    // Las comas dentro de :is(…) no separan selectores.
    for (const sel of selectores) for (const parte of sel.split(/,(?![^(]*\))/)) expect(parte.trim(), parte).toMatch(/^\.do\b/);
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

  it("las tablas de los decretos: ancho mínimo moderado dentro de su región, sin cursor de mano ni resaltado de fila", () => {
    const ancho = Number(/\.do-tabla table\s*\{[^}]*min-width:\s*(\d+)px/.exec(sinComentarios)?.[1] ?? 0);
    expect(ancho).toBeGreaterThanOrEqual(600);
    expect(ancho).toBeLessThan(980);
    expect(sinComentarios).toMatch(/\.do-tabla tbody tr\s*\{[^}]*cursor:\s*default/);
    expect(sinComentarios).toMatch(/\.do-tabla tbody tr:hover\s*\{[^}]*background:\s*none/);
  });

  it("en las tablas de los decretos los encabezados van a la izquierda, como su texto; los de cifras, a la derecha", () => {
    expect(sinComentarios).toMatch(/\.do-tabla th\s*\{[^}]*text-align:\s*left/);
    expect(sinComentarios).toMatch(/\.do-tabla th\.num\s*\{[^}]*text-align:\s*right/);
  });

  it("los encabezados de columna de los decretos no bajan de 12 px (tablero.css los deja en 11; revisión a11y-architect, MEDIO)", () => {
    expect(Number(/\.do-tabla th\[scope="col"\]\s*\{[^}]*font-size:\s*(\d+)px/.exec(sinComentarios)?.[1] ?? 0)).toBeGreaterThanOrEqual(12);
  });

  it("la especie (encabezado de fila) queda fija al desplazar la tabla, con fondo; la pista de desplazar solo en el celular (revisión a11y-architect, MEDIO)", () => {
    expect(sinComentarios).toMatch(/\.do-tabla :is\(th\[scope="row"\], thead th:first-child\)\s*\{[^}]*position:\s*sticky[^}]*left:\s*0[^}]*background:\s*var\(--panel\)/);
    const sinMedia = sinComentarios.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    const celular = /@media \(max-width: 620px\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(sinMedia).toMatch(/\.do-desliza\s*\{[^}]*display:\s*none/);
    expect(celular).toMatch(/\.do-desliza\s*\{[^}]*display:\s*block/);
  });

  it("en alto contraste, la fila en disputa conserva su franja como borde", () => {
    const bloque = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(bloque).toMatch(/\.do-tabla tr\[data-disputa\] > th\s*\{[^}]*border-left:\s*3px solid CanvasText/);
  });

  it("la región de cada tabla es relativa: el texto solo para el lector (.sr, absoluto) no se escapa y no estira la página a 375 px", () => {
    // El e2e a 375 px lo encontró: sin esto, el .sr de una celda lejana toma de referencia la página y la desborda.
    expect(sinComentarios).toMatch(/\.do-tabla\s*\{[^}]*position:\s*relative/);
  });

  it("el estado del cruce y la marca de la disputa tienen borde y en alto contraste se siguen viendo", () => {
    expect(sinComentarios).toMatch(/\.do-cruce-estado\s*\{[^}]*border:\s*1px solid/);
    expect(sinComentarios).toMatch(/\.do-disputa\s*\{[^}]*border:\s*1px dashed/);
    const bloque = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(bloque).toMatch(/\.do-cruce-estado[^{]*\{[^}]*border-color:\s*CanvasText/);
    expect(bloque).toMatch(/\.do-disputa[^{]*\{[^}]*border-color:\s*CanvasText/);
  });

  it("el enlace de la referencia mide al menos 24 px de alto y ninguna letra baja de 12 px", () => {
    expect(sinComentarios).toMatch(/\.do-tabla a\s*\{[^}]*display:\s*inline-block[^}]*padding-block:\s*[3-9]px/);
    const tamanos = [...sinComentarios.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(tamanos.length).toBeGreaterThan(5);
    expect(Math.min(...tamanos)).toBeGreaterThanOrEqual(12);
  });

  it("no anima nada propio", () => {
    expect(sinComentarios).not.toMatch(/\banimation\b|\btransition\b|@keyframes/);
  });
});
