// @vitest-environment jsdom
// Estilos de /operar (frente operar-informe, hallazgos MEDIOS de react-reviewer y a11y-architect): cada clase op-* que
// pinta la pantalla tiene su regla en operar.css y cada regla .op-* de operar.css se usa (si no, un énfasis se pierde
// sin que nada lo note); todo cuelga de .operar; solo tokens de color (claro y oscuro salen de tablero.css); y el foco
// no queda tapado por el encabezado fijo (scroll-padding-top, solo en las páginas con main.operar). Datos inventados.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Operar } from "@/app/operar/Operar";
import { aVistaOperar } from "@/app/operar/serializar";
import { armarInforme } from "@/operar/informe/armar";
import { entradas, entradasCompletas, entradasRaras, HOY } from "./ficticio";

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "src", "app", "operar", "operar.css"), "utf8");
const sinComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Las clases op-* que aparecen en la pantalla pintada con todos sus casos. */
function clasesPintadas(): Set<string> {
  const casos = [entradasCompletas(), entradasRaras(), entradas({ especies: [] }), entradas({ plan: { numero: 3, vigenteDesde: HOY, reglas: [] } })];
  const raiz = document.createElement("div");
  raiz.innerHTML = casos.map((e) => renderToStaticMarkup(createElement(Operar, { vista: aVistaOperar(armarInforme(e, HOY)) }))).join("");
  return new Set([...raiz.querySelectorAll("[class]")].flatMap((el) => [...el.classList]).filter((c) => c.startsWith("op-")));
}

const clasesDelCss = (): Set<string> => new Set([...sinComentarios.matchAll(/\.(op-[a-z0-9-]+)/g)].map((m) => m[1]!));

describe("estilos de src/app/operar", () => {
  it("cada clase op-* de la pantalla tiene su regla, y cada regla .op-* se usa", () => {
    const pintadas = clasesPintadas();
    const css = clasesDelCss();
    expect(pintadas.size).toBeGreaterThan(5);
    expect([...pintadas].filter((c) => !css.has(c))).toEqual([]);
    expect([...css].filter((c) => !pintadas.has(c))).toEqual([]);
  });

  it("toda regla cuelga de .operar (o de la página que la contiene) y no hay colores fijos", () => {
    const selectores = [...sinComentarios.matchAll(/([^{}]+)\{/g)].map((m) => m[1]!.trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
    expect(selectores.length).toBeGreaterThan(5);
    expect(selectores.filter((s) => !s.startsWith(".operar ") && !s.startsWith("html:has(main.operar)"))).toEqual([]);
    expect(sinComentarios).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it("el foco no queda tapado por el encabezado fijo: scroll-padding-top en las páginas con main.operar", () => {
    expect(sinComentarios).toMatch(/html:has\(main\.operar\)\s*\{[^}]*scroll-padding-top:\s*\d+px/);
  });
});
