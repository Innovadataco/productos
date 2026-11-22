// @vitest-environment jsdom
// Dona de composición (frente graficas-tablero): tajadas con hueco, centro que cambia al señalar, leyenda con
// nombre, valor y porcentaje (visible: no depende del color) y clic para ir al origen de la cifra. Inventado.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dona, type PropsDona } from "@/app/_graficas";
import { desenfocar, enfocar, montar, movimiento, observador, puntero, texto, type Montaje } from "./dom";

const props = (o: Partial<PropsDona> = {}): PropsDona => ({
  titulo: "Composición",
  resumen: "FICTB 57,1 %, FICTA 41,0 %, Otras 1,9 %.",
  segmentos: [
    { id: "b", nombre: "FICTB", valor: 153040, textoValor: "$ 153.040", textoPct: "57,1 %" },
    { id: "a", nombre: "FICTA", valor: 110000, textoValor: "$ 110.000", textoPct: "41,0 %" },
    { id: "otras", nombre: "Otras", valor: 5050, textoValor: "$ 5.050", textoPct: "1,9 %", tono: "neutro", detalle: "FICTC y FICTD", elegible: false },
  ],
  centro: { etiqueta: "Valor en acciones", texto: "$ 268.090" },
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

const centro = () => texto(m.contenedor.querySelector(".g-centro"));
const items = () => [...m.contenedor.querySelectorAll<HTMLElement>(".g-leyenda-dona li")];

describe("Dona", () => {
  it("una tajada por segmento con su tono (el orden da el color; «Otras» va neutra); el dibujo es decorativo", async () => {
    await m.pintar(createElement(Dona, props()));
    const tajadas = [...m.contenedor.querySelectorAll("circle.g-tajada")];
    expect(tajadas.map((t) => t.getAttribute("class"))).toEqual(["g-tajada t-c1", "g-tajada t-c2", "g-tajada t-neutro"]);
    expect(m.contenedor.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    const figura = m.contenedor.querySelector("figure")!;
    expect(texto(document.getElementById(figura.getAttribute("aria-labelledby")!))).toBe("Composición");
    expect(texto(document.getElementById(figura.getAttribute("aria-describedby")!))).toBe("FICTB 57,1 %, FICTA 41,0 %, Otras 1,9 %.");
  });

  it("la leyenda da nombre, valor y porcentaje de cada tajada; «Otras» dice qué incluye", async () => {
    await m.pintar(createElement(Dona, props()));
    expect(items().map(texto)).toEqual(["FICTB $ 153.040 57,1 %", "FICTA $ 110.000 41,0 %", "Otras $ 5.050 1,9 % FICTC y FICTD"]);
  });

  it("el centro muestra el total y, al señalar una tajada (leyenda o dibujo), la de esa tajada", async () => {
    await m.pintar(createElement(Dona, props()));
    expect(centro()).toBe("Valor en acciones $ 268.090");
    await puntero(items()[1]!, "entrar");
    expect(centro()).toBe("FICTA $ 110.000 41,0 %");
    await puntero(items()[1]!, "salir");
    expect(centro()).toBe("Valor en acciones $ 268.090");
    await puntero(m.contenedor.querySelectorAll("circle.g-tajada")[0]!, "entrar");
    expect(centro()).toBe("FICTB $ 153.040 57,1 %");
    expect(items()[0]!.getAttribute("data-activo")).toBe("");
    await puntero(m.contenedor.querySelectorAll("circle.g-tajada")[0]!, "salir");
    expect(centro()).toBe("Valor en acciones $ 268.090");
  });

  it("con alElegir, las tajadas elegibles son botones que llevan al detalle; el foco también señala", async () => {
    const alElegir = vi.fn();
    await m.pintar(createElement(Dona, props({ alElegir })));
    const botones = [...m.contenedor.querySelectorAll<HTMLButtonElement>(".g-leyenda-dona button")];
    expect(botones.map((b) => texto(b))).toEqual(["FICTB $ 153.040 57,1 % (ver el detalle)", "FICTA $ 110.000 41,0 % (ver el detalle)"]);
    await enfocar(botones[1]!);
    expect(centro()).toBe("FICTA $ 110.000 41,0 %");
    await desenfocar(botones[1]!);
    expect(centro()).toBe("Valor en acciones $ 268.090");
    botones[0]!.click();
    expect(alElegir).toHaveBeenCalledWith("b", botones[0]);
    (m.contenedor.querySelectorAll("circle.g-tajada")[1] as SVGCircleElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(alElegir).toHaveBeenLastCalledWith("a", botones[1]);
    (m.contenedor.querySelectorAll("circle.g-tajada")[2] as SVGCircleElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(alElegir).toHaveBeenCalledTimes(2);
  });

  it("las tajadas se dibujan al entrar en pantalla: el dibujo se marca visible (el CSS las oculta mientras tanto)", async () => {
    const io = observador();
    await m.pintar(createElement(Dona, props()));
    const dibujo = m.contenedor.querySelector(".g-dona-dibujo")!;
    expect(dibujo.hasAttribute("data-visible")).toBe(false);
    await io.entrar();
    expect(dibujo.hasAttribute("data-visible")).toBe(true);
  });

  it("lo que pinta el servidor ya trae cada tajada completa: sin JS la dona se ve (hallazgo MEDIO de react-reviewer)", () => {
    const html = renderToStaticMarkup(createElement(Dona, props()));
    const dash = [...html.matchAll(/<circle[^>]*class="g-tajada[^"]*"[^>]*>/g)].map((c) => /stroke-dasharray="([^"]+)"/.exec(c[0])?.[1] ?? "");
    expect(dash).toHaveLength(3);
    dash.forEach((d) => expect(d).toMatch(/^[1-9][\d.]* [\d.]+$/));
  });

  it("sin segmentos con valor, dice que no hay qué repartir", async () => {
    await m.pintar(createElement(Dona, props({ segmentos: [] })));
    expect(texto(m.contenedor.querySelector("figure"))).toContain("Sin valores para repartir");
  });
});
