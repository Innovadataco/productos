// Estilos de la procedencia de cada dato (frente fecha-hora-datos): una nota chica bajo la cifra, en claro y oscuro con
// los tokens del tablero (ningún color fijo), legible (12 px o más), que se parte a 375 px sin salirse, sin animación,
// y el aviso de fechas distintas también con texto (no solo color). Todo dentro de .fecha-dato*: no toca otras pantallas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../../../src/app/_comun/fecha-dato/fecha-dato.css", import.meta.url)), "utf8");
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
const bloque = (selector: string) => new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(sinComentarios)?.[2] ?? "";

describe("fecha-dato.css", () => {
  it("sin colores fijos: todo por los tokens de tablero.css (claro y oscuro)", () => {
    expect(sinComentarios.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
    expect(bloque(".fecha-dato")).toMatch(/color:\s*var\(--muted\)/);
    expect(bloque(".fecha-dato-aviso")).toMatch(/color:\s*var\(--loss\)/);
  });

  it("todo queda dentro de .fecha-dato* (o de ese bloque en una td): no toca las otras pantallas", () => {
    const selectores = sinComentarios.replace(/@media[^{]*\{/g, "").split("}").map((b) => b.split("{")[0]!.trim()).filter(Boolean);
    expect(selectores.length).toBeGreaterThan(1);
    for (const sel of selectores) for (const parte of sel.split(",")) expect(parte.trim(), parte).toMatch(/^(td )?\.fecha-dato(-[a-z]+)?\b/);
  });

  it("legible: ninguna letra por debajo de 12 px, y la nota no hereda las mayúsculas ni el peso de las cifras", () => {
    const tamanos = [...sinComentarios.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(tamanos.length).toBeGreaterThan(0);
    for (const t of tamanos) expect(t).toBeGreaterThanOrEqual(12);
    expect(bloque(".fecha-dato")).toMatch(/text-transform:\s*none/);
    expect(bloque(".fecha-dato")).toMatch(/font-weight:\s*400/);
    expect(bloque(".fecha-dato")).toMatch(/font-family:\s*var\(--body\)/);
  });

  it("a 375 px se parte en líneas y no se sale de su caja", () => {
    expect(bloque(".fecha-dato")).toMatch(/display:\s*block/);
    expect(bloque(".fecha-dato")).toMatch(/white-space:\s*normal/);
    expect(bloque(".fecha-dato")).toMatch(/overflow-wrap:\s*anywhere/);
    // En una celda de tabla, «anywhere» deja la columna en el mínimo y parte la línea letra por letra: ahí, break-word.
    const enCelda = bloque("td .fecha-dato");
    expect(enCelda).toMatch(/overflow-wrap:\s*break-word/);
    expect(enCelda).not.toMatch(/anywhere/);
    expect(enCelda).toMatch(/max-width:\s*\d+em/);
  });

  it("no anima nada", () => {
    expect(sinComentarios).not.toMatch(/animation|transition|@keyframes/);
  });

  it("no hay estilo de un detalle oculto: la fuente y la hora van una sola vez, en la línea visible", () => {
    expect(sinComentarios).not.toMatch(/fecha-dato-detalle/);
    expect(sinComentarios).not.toMatch(/clip-path|clip:\s*rect/);
  });
});
