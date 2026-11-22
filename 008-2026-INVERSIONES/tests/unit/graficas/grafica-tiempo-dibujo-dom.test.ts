// @vitest-environment jsdom
// Extensiones compatibles de la gráfica de tiempo para la pantalla de proyecciones (frente proyecciones-pantalla):
// - `dibujo`: las series y bandas que se TRAZAN mientras se interpola un resultado (el SVG y los puntos); la leyenda,
//   el detalle, el deslizador y la tabla siguen con los valores finales (no cambian en cada cuadro);
// - `Banda.degradado`: la banda se rellena con un degradado horizontal (más intenso cerca de «Hoy») por una variable
//   CSS, así la regla de alto contraste sigue mandando.
// Sin las props nuevas, la gráfica pinta exactamente lo mismo que antes (el tablero no cambia). Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraficaTiempo, type Banda, type PropsGraficaTiempo, type SerieTiempo } from "@/app/_graficas";
import { alternar, enfocar, montar, movimiento, texto, type Montaje } from "./dom";

const DIAS = ["2027-03-01", "2027-04-01", "2027-05-01", "2027-06-01"];
const MEDIANA: SerieTiempo = { id: "p50", nombre: "Mediana", tono: "valor", valores: [null, 4613, 4701, 4793] };
const BANDA: Banda = { id: "p5", nombre: "P5–P95", tono: "valor", intensidad: "suave", bajo: [null, 4613, 4391, 4207], alto: [null, 4613, 4977, 5213] };
const base = (o: Partial<PropsGraficaTiempo> = {}): PropsGraficaTiempo => ({
  titulo: "Proyección",
  resumen: "Mediana de $4613 a $4793.",
  dias: DIAS,
  series: [MEDIANA],
  bandas: [BANDA],
  corte: { indice: 1, nombre: "Hoy" },
  formatoY: (v) => `$${v}`,
  formatoEje: (v) => `e${v}`,
  formatoDia: (d) => `día ${d}`,
  formatoTick: (d) => d,
  ...o,
});

let m: Montaje;
beforeEach(() => {
  movimiento(true);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});

const linea = () => m.contenedor.querySelector("path.g-linea")!.getAttribute("d");
const banda = () => m.contenedor.querySelector<SVGPathElement>("path.g-banda")!;
const toque = () => m.contenedor.querySelector<HTMLElement>("[role=slider]")!;

describe("GraficaTiempo · dibujo (interpolación de un resultado)", () => {
  it("sin `dibujo`, el trazo es el de las series; con `dibujo`, el SVG traza lo de `dibujo`", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    const final = linea();
    const bandaFinal = banda().getAttribute("d");
    const intermedia: SerieTiempo = { ...MEDIANA, valores: [null, 4613, 4657, 4703] };
    await m.pintar(createElement(GraficaTiempo, base({ dibujo: { series: [intermedia], bandas: [{ ...BANDA, alto: [null, 4613, 4791, 4889] }] } })));
    expect(linea()).not.toBe(final);
    expect(banda().getAttribute("d")).not.toBe(bandaFinal);
    // El mismo dibujo que tendría una gráfica con esas series como finales.
    const otra = montar();
    await otra.pintar(createElement(GraficaTiempo, base({ series: [intermedia], bandas: [{ ...BANDA, alto: [null, 4613, 4791, 4889] }] })));
    expect(linea()).toBe(otra.contenedor.querySelector("path.g-linea")!.getAttribute("d"));
    otra.desmontar();
  });

  it("la leyenda, el deslizador y la tabla dicen los valores finales, no los del cuadro", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ dibujo: { series: [{ ...MEDIANA, valores: [null, 4613, 4657, 4703] }] } })));
    expect(toque().getAttribute("aria-valuetext")).toBe("día 2027-06-01 · $4793 Mediana · $4207 – $5213 P5–P95");
    await enfocar(toque());
    expect(texto(m.contenedor.querySelector(".g-tip"))).toContain("$4793");
    await alternar(m.contenedor.querySelector("details")!, true);
    const filas = [...m.contenedor.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(texto).join(" "));
    expect(filas.at(-1)).toBe("día 2027-06-01 $4793 $4207 – $5213");
  });

  it("los puntos del final siguen al trazo (no quedan flotando lejos de la línea que se ve)", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    const topFinal = m.contenedor.querySelector<HTMLElement>(".g-fin")!.style.top;
    await m.pintar(createElement(GraficaTiempo, base({ dibujo: { series: [{ ...MEDIANA, valores: [null, 4613, 4657, 4391] }] } })));
    expect(m.contenedor.querySelector<HTMLElement>(".g-fin")!.style.top).not.toBe(topFinal);
  });
});

describe("GraficaTiempo · banda con degradado", () => {
  it("sin `degradado`, la banda no trae degradado ni variable (el tablero queda igual)", () => {
    const html = renderToStaticMarkup(createElement(GraficaTiempo, base()));
    expect(html).not.toContain("linearGradient");
    expect(html).not.toContain("--g-relleno-banda");
  });

  it("con `degradado`, un linearGradient horizontal por banda, con id válido, su tono y la variable en la banda", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ bandas: [{ ...BANDA, degradado: true }, { ...BANDA, id: "p25", nombre: "P25–P75", intensidad: "media", degradado: true }] })));
    const degradados = [...m.contenedor.querySelectorAll("defs linearGradient")];
    expect(degradados).toHaveLength(2);
    degradados.forEach((g) => {
      expect(g.id).toMatch(/^[A-Za-z][\w-]*$/);
      expect(g.getAttribute("class")).toContain("t-valor");
      expect([g.getAttribute("x1"), g.getAttribute("x2"), g.getAttribute("y1"), g.getAttribute("y2")]).toEqual(["0", "1", "0", "0"]);
      expect(g.querySelectorAll("stop")).toHaveLength(2);
    });
    const bandas = [...m.contenedor.querySelectorAll<SVGPathElement>("path.g-banda")];
    expect(bandas.map((b) => b.getAttribute("style"))).toEqual(degradados.map((g) => `--g-relleno-banda: url(#${g.id});`));
    expect(bandas.every((b) => b.classList.contains("g-banda-degradada"))).toBe(true);
  });

  it("la clave de la leyenda de una banda con degradado también lo muestra", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ series: [MEDIANA, { id: "ap", nombre: "Aportado", tono: "costo", valores: [null, 4613, 4613, 4613], trazo: "punteado" }], bandas: [{ ...BANDA, degradado: true }] })));
    expect(m.contenedor.querySelector(".g-leyenda .g-clave-banda")!.classList.contains("g-clave-degradada")).toBe(true);
  });
});
