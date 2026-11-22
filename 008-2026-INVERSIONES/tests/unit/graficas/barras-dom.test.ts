// @vitest-environment jsdom
// Barras divergentes (frente graficas-tablero): crecen desde el cero, el valor va en texto en la punta y cada fila
// lleva a su detalle. Inventado.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Barras, type PropsBarras } from "@/app/_graficas";
import { montar, movimiento, observador, texto, type Montaje } from "./dom";

const props = (o: Partial<PropsBarras> = {}): PropsBarras => ({
  titulo: "Rentabilidad sin vender",
  resumen: "FICTA +10,0 %, FICTB −4,3 %.",
  filas: [
    { id: "a", nombre: "FICTA", valor: 10, texto: "+10,0 %", detalle: "costo $ 100.000 · valor $ 110.000" },
    { id: "b", nombre: "FICTB", valor: -5, texto: "−5,0 %" },
  ],
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

const filas = () => [...m.contenedor.querySelectorAll<HTMLElement>(".g-barra")];
const relleno = (f: HTMLElement) => f.querySelector<HTMLElement>(".g-barra-relleno")!;

describe("Barras", () => {
  it("una fila por especie con su nombre, su valor en texto y su detalle; con tono por signo", async () => {
    await m.pintar(createElement(Barras, props()));
    expect(filas().map(texto)).toEqual(["FICTA +10,0 % costo $ 100.000 · valor $ 110.000", "FICTB −5,0 %"]);
    expect(filas().map((f) => relleno(f).className)).toEqual(["g-barra-relleno t-gana", "g-barra-relleno t-pierde"]);
    const figura = m.contenedor.querySelector("figure")!;
    expect(texto(document.getElementById(figura.getAttribute("aria-labelledby")!))).toBe("Rentabilidad sin vender");
    expect(texto(document.getElementById(figura.getAttribute("aria-describedby")!))).toBe("FICTA +10,0 %, FICTB −4,3 %.");
  });

  it("las barras arrancan en el cero: la positiva a su derecha, la negativa a su izquierda", async () => {
    await m.pintar(createElement(Barras, props()));
    const [a, b] = filas().map(relleno);
    expect([a!.style.left, a!.style.width]).toEqual(["33.33%", "66.67%"]);
    expect([b!.style.left, b!.style.width]).toEqual(["0%", "33.33%"]);
    expect(m.contenedor.querySelector<HTMLElement>(".g-barra-cero")!.style.left).toBe("33.33%");
  });

  it("sin alElegir las filas no son botones; con alElegir, cada una lleva a su detalle", async () => {
    await m.pintar(createElement(Barras, props()));
    expect(m.contenedor.querySelector("button")).toBeNull();
    const alElegir = vi.fn();
    await m.pintar(createElement(Barras, props({ alElegir })));
    const b = m.contenedor.querySelectorAll<HTMLButtonElement>("button.g-barra")[1]!;
    b.click();
    expect(alElegir).toHaveBeenCalledWith("b", b);
  });

  it("las barras crecen al entrar en pantalla", async () => {
    const io = observador();
    await m.pintar(createElement(Barras, props()));
    const lista = m.contenedor.querySelector(".g-barras")!;
    expect(lista.hasAttribute("data-visible")).toBe(false);
    await io.entrar();
    expect(lista.hasAttribute("data-visible")).toBe(true);
  });

  it("sin filas, lo dice", async () => {
    await m.pintar(createElement(Barras, props({ filas: [] })));
    expect(texto(m.contenedor.querySelector("figure"))).toContain("Sin especies con rentabilidad");
  });
});
