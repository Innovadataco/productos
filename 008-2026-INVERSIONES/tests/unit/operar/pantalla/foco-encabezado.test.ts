// El foco del teclado en /operar no queda debajo del encabezado fijo (WCAG 2.4.11): con «Análisis» en el menú (otro
// frente), el encabezado mide 183,5 px a 375 px; el margen de desplazamiento de /operar debe pasarlo con holgura (240 px).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.join(__dirname, "..", "..", "..", "..", "src", "app", "operar", "operar.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("/operar · el foco no queda bajo el encabezado fijo", () => {
  it("scroll-padding-top de al menos 240 px", () => {
    const px = Number(/html:has\(main\.operar\)\s*\{[^}]*scroll-padding-top:\s*(\d+)px/.exec(CSS)?.[1] ?? "0");
    expect(px).toBeGreaterThanOrEqual(240);
  });
});
