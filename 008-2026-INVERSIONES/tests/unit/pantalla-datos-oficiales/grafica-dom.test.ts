// @vitest-environment jsdom
// La gráfica de una serie de /datos-oficiales (frente datos-oficiales-pantalla, C6a) con la gráfica de tiempo del
// módulo común (src/app/_graficas): un punto por vigencia (en el IPC, por mes), con nombre accesible, el resumen con las
// cifras, el deslizador que dice el día, el valor y hasta cuándo vale un tramo, y «Ver los datos». Lo que pinta el
// servidor es determinista (dos pintadas iguales: hidrata sin diferencias). Cifras inventadas.
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraficaSerie } from "@/app/datos-oficiales/GraficaSerie";
import { resumenGrafica, tituloGrafica } from "@/app/datos-oficiales/formato";
import type { SerieConDatos } from "@/app/datos-oficiales/tipos";
import { IPC, TPM, TRM } from "./ficticio";

const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pintar(serie: SerieConDatos): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(GraficaSerie, { serie }));
  return raiz;
}

describe("GraficaSerie", () => {
  it("una figura con su título, el resumen con las cifras y la tabla de datos", () => {
    const raiz = pintar(TRM);
    const figura = raiz.querySelector("figure")!;
    expect(texto(raiz.querySelector(`#${figura.getAttribute("aria-labelledby")}`))).toBe(tituloGrafica(TRM));
    expect(texto(figura.querySelector(".g-sr"))).toBe(resumenGrafica(TRM));
    expect(texto(figura.querySelector("details summary"))).toBe("Ver los datos");
    expect(figura.querySelectorAll("path.g-linea")).toHaveLength(1);
  });

  it("el deslizador recorre las vigencias y dice el día y el valor del último", () => {
    const slider = pintar(TRM).querySelector("[role=slider]")!;
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe(String(TRM.historia.length - 1));
    expect(slider.getAttribute("aria-valuetext")).toBe("17-mar-2021 · 3.923,07 Tasa Representativa del Mercado");
  });

  it("un tramo de varios días dice hasta cuándo vale", () => {
    const tramo: SerieConDatos = { ...TRM, historia: TRM.historia.slice(0, 2) };
    expect(pintar(tramo).querySelector("[role=slider]")?.getAttribute("aria-valuetext")).toBe(
      "13-mar-2021 · 3.921,17 Tasa Representativa del Mercado · Vigente hasta el 15-mar-2021",
    );
  });

  it("las tasas con %, el IPC por mes", () => {
    expect(pintar(TPM).querySelector("[role=slider]")?.getAttribute("aria-valuetext")).toBe("16-mar-2021 · 4,37 % Tasa de política monetaria");
    expect(pintar(IPC).querySelector("[role=slider]")?.getAttribute("aria-valuetext")).toBe("feb-2021 · 134,93 Índice de precios al consumidor");
  });

  it("lo que pinta el servidor es igual en dos pintadas (formatos deterministas)", () => {
    for (const s of [TRM, TPM, IPC]) expect(renderToString(createElement(GraficaSerie, { serie: s }))).toBe(renderToString(createElement(GraficaSerie, { serie: s })));
  });

  it("sin dos puntos, la nota y ninguna figura", () => {
    const raiz = pintar({ ...IPC, historia: [] });
    expect(raiz.querySelector("figure")).toBeNull();
    expect(texto(raiz.querySelector(".do-sin-grafica"))).toBe("No hay valores en los últimos cinco años: el último cargado es anterior.");
  });
});
