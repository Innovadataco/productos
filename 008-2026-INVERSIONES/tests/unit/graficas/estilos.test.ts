// Estilos del módulo de gráficas (frente graficas-tablero, hallazgos MEDIOS de react-reviewer y a11y-architect):
// - el módulo solo usa sus clases (g-*, t-*): no depende de .sr, .nota ni .pill del tablero, ni del orden del CSS;
// - la paleta categórica (dona) da ≥ 3:1 contra el panel en claro (#ffffff) y en oscuro (#131a2a) (WCAG 1.4.11).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../../src/app/_graficas/", import.meta.url));
const css = readFileSync(`${DIR}graficas.css`, "utf8");

/** Las clases fijas de un className (comillas o la parte fija de una plantilla). */
function clases(fuente: string): string[] {
  const literales = [...fuente.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, " "));
  return literales.flatMap((l) => l.split(/\s+/)).filter(Boolean);
}

const ajenas = (cs: readonly string[]) => cs.filter((c) => !/^(g|t)-/.test(c));
const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luz = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const contraste = (a: string, b: string) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

/** Los --g-c1…c8 del primer bloque (oscuro) y del bloque claro (data-theme="light"). */
function paleta(bloque: RegExp): string[] {
  const texto = bloque.exec(css)?.[1] ?? "";
  return Array.from({ length: 8 }, (_, k) => new RegExp(`--g-c${k + 1}: (#[0-9a-f]{6})`).exec(texto)?.[1] ?? "");
}

describe("estilos de src/app/_graficas", () => {
  it("los componentes solo usan clases propias (g-*, t-*)", () => {
    const tsx = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
    expect(tsx.flatMap((f) => ajenas(clases(readFileSync(`${DIR}${f}`, "utf8"))).map((c) => `${f}: ${c}`))).toEqual([]);
  });

  it("el candado de clases muerde", () => {
    expect(ajenas(clases('<p className="sr">x</p><b className={`pill t-${a}`} /><i className="g-clave" />'))).toEqual(["sr", "pill"]);
  });

  it.each([
    ["oscuro", /^:root \{([^}]*)\}/m, "#131a2a"],
    ["claro", /:root\[data-theme="light"\] \{([^}]*)\}/m, "#ffffff"],
  ])("paleta categórica %s: los 8 tonos dan ≥ 3:1 contra el panel", (_modo, bloque, panel) => {
    const tonos = paleta(bloque);
    expect(tonos.every((t) => /^#[0-9a-f]{6}$/.test(t))).toBe(true);
    expect(tonos.filter((t) => contraste(t, panel) < 3)).toEqual([]);
  });

  it("el claro por preferencia del sistema usa la misma paleta que el botón «Tema claro»", () => {
    expect(paleta(/:root:not\(\[data-theme="dark"\]\) \{([^}]*)\}/m)).toEqual(paleta(/:root\[data-theme="light"\] \{([^}]*)\}/m));
  });
});
