// @vitest-environment jsdom
// El componente de la procedencia (frente fecha-hora-datos), pintado en el servidor y leído en un DOM: dice lo mismo que
// sus textos puros, con <time> para el día del dato y la hora de Colombia, y en un valor compuesto el aviso de fechas
// distintas solo si las hay. No es un control ni una región viva (no lleva role, ni enlaces, ni botones): es una nota.
// Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { FechaDato, FechaDatoCompuesta } from "@/app/_comun/fecha-dato/FechaDato";
import { avisoMezcladas, textoCompuesta, textoProcedencia } from "@/app/_comun/fecha-dato/textos";
import type { Procedencia, ProcedenciaCompuesta } from "@/app/_comun/fecha-dato/tipos";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const P: Procedencia = { dia: "2027-03-17", traidoEn: "2027-03-17 18:04", fuente: "yahoo" };
const MEZCLADAS: ProcedenciaCompuesta = { masVieja: { dia: "2021-03-01", traidoEn: "2021-03-02 18:40", fuente: "e2e-ficticio" }, masReciente: "2021-03-17", mezcladas: true, fuentes: ["e2e-ficticio", "yahoo"] };
const MISMO_DIA: ProcedenciaCompuesta = { masVieja: P, masReciente: "2027-03-17", mezcladas: false, fuentes: ["yahoo"] };

function pintar(el: ReturnType<typeof createElement>): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(el);
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const tiempos = (raiz: HTMLElement) => [...raiz.querySelectorAll("time")].map((t) => [t.getAttribute("datetime"), texto(t)]);

describe("FechaDato", () => {
  it("dice lo mismo que textoProcedencia, en una sola nota con su clase", () => {
    const raiz = pintar(createElement(FechaDato, { procedencia: P, etiqueta: "Cierre" }));
    const nota = raiz.querySelector(".fecha-dato");
    expect(nota).not.toBeNull();
    expect(texto(nota)).toBe(textoProcedencia(P, { etiqueta: "Cierre" }));
    expect(tiempos(raiz)).toEqual([["2027-03-17", "17-mar-2027"], ["2027-03-17T18:04-05:00", "17-mar-2027 a las 18:04"]]);
  });

  it("sin la fecha, cuando la celda ya la dice; sin la hora en que se trajo, lo dice y no pinta <time> de hora", () => {
    expect(texto(pintar(createElement(FechaDato, { procedencia: P, sinFecha: true })))).toBe(textoProcedencia(P, { sinFecha: true }));
    const sinHora = pintar(createElement(FechaDato, { procedencia: { ...P, traidoEn: null }, etiqueta: "Cierre" }));
    expect(texto(sinHora)).toBe("Cierre del 17-mar-2027 · sin la hora en que se trajo · BVC por Yahoo");
    expect(tiempos(sinHora)).toEqual([["2027-03-17", "17-mar-2027"]]);
  });

  it("es una nota: sin role, sin región viva y sin nada que se pueda tocar", () => {
    const html = renderToStaticMarkup(createElement(FechaDato, { procedencia: P }));
    expect(html).not.toMatch(/role=|aria-live|<a |<button|<input|tabindex/i);
    expect(html).not.toMatch(/class="[^"]*\b(sr|cifra|nota|pill|chip)\b/);
  });
});

describe("FechaDatoCompuesta", () => {
  it("con fechas distintas: el cierre más antiguo y el aviso con las dos puntas", () => {
    const raiz = pintar(createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }));
    const aviso = raiz.querySelector(".fecha-dato-aviso");
    expect(texto(raiz.querySelector(".fecha-dato-linea"))).toBe(textoCompuesta(MEZCLADAS));
    expect(texto(aviso)).toBe(avisoMezcladas(MEZCLADAS));
    expect(texto(raiz)).toBe(`${textoCompuesta(MEZCLADAS)} ${avisoMezcladas(MEZCLADAS)}`);
    expect(tiempos(raiz)).toEqual([["2021-03-01", "1-mar-2021"], ["2021-03-02T18:40-05:00", "2-mar-2021 a las 18:40"], ["2021-03-01", "1-mar-2021"], ["2021-03-17", "17-mar-2021"]]);
  });

  it("todos del mismo día: sin aviso", () => {
    const raiz = pintar(createElement(FechaDatoCompuesta, { compuesta: MISMO_DIA }));
    expect(texto(raiz)).toBe(textoCompuesta(MISMO_DIA));
    expect(raiz.querySelector(".fecha-dato-aviso")).toBeNull();
  });

  it("es una nota: sin role ni región viva", () => {
    expect(renderToStaticMarkup(createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }))).not.toMatch(/role=|aria-live|<a |<button/i);
  });
});

describe("hidratación", () => {
  it("lo que pinta el servidor es lo que pinta el navegador (sin avisos de React)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const el = createElement("div", null, createElement(FechaDato, { procedencia: P, etiqueta: "Cierre" }), createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }));
    const contenedor = document.createElement("div");
    contenedor.innerHTML = renderToStaticMarkup(el);
    document.body.append(contenedor);
    const antes = contenedor.innerHTML;
    await act(async () => { hydrateRoot(contenedor, el); });
    expect(contenedor.innerHTML).toBe(antes);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
    contenedor.remove();
  });
});
