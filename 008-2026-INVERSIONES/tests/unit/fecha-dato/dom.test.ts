// @vitest-environment jsdom
// El componente de la procedencia (frente fecha-hora-datos), pintado en el servidor y leído en un DOM: dice lo mismo que
// sus textos puros, con <time> para el día del dato y la hora de Colombia, y en un valor compuesto el aviso de fechas
// distintas y el de dato viejo solo si los hay. No lleva un detalle oculto que repita la fuente y la hora. No es un control ni una región viva (sin role, enlaces ni botones): es una nota.
// Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { FechaDato, FechaDatoCompuesta } from "@/app/_comun/fecha-dato/FechaDato";
import { avisoAtraso, avisoMezcladas, textoCompuesta, textoProcedencia } from "@/app/_comun/fecha-dato/textos";
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

const linea = (raiz: HTMLElement) => texto(raiz.querySelector(".fecha-dato-linea"));
const VIEJO: Procedencia = { ...P, habilesAtras: 3 };

describe("FechaDato", () => {
  it("la línea dice lo mismo que textoProcedencia, en una sola nota con su clase", () => {
    const raiz = pintar(createElement(FechaDato, { procedencia: P, etiqueta: "Cierre" }));
    expect(raiz.querySelector(".fecha-dato")).not.toBeNull();
    expect(linea(raiz)).toBe(textoProcedencia(P, { etiqueta: "Cierre" }));
    expect(linea(raiz)).toBe("Cierre 17-mar · Yahoo (BVC) · traído 18:04");
    expect(tiempos(raiz)).toEqual([["2027-03-17", "17-mar"], ["2027-03-17T18:04-05:00", "18:04"]]);
  });

  it("no hay un detalle oculto: no existe .fecha-dato-detalle y la fuente y la hora salen una sola vez", () => {
    for (const el of [
      createElement(FechaDato, { procedencia: P, etiqueta: "Cierre" }),
      createElement(FechaDato, { procedencia: { ...P, tipo: "RUEDA", horaDato: "11:42" }, sinFecha: true }),
      createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }),
    ]) {
      const raiz = pintar(el);
      expect(raiz.querySelector(".fecha-dato-detalle")).toBeNull();
      expect(texto(raiz.querySelector(".fecha-dato")).match(/Yahoo \(BVC\)/g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(texto(raiz)).not.toMatch(/Retraso conocido|hora de Colombia|Fuente:/);
    }
    expect(renderToStaticMarkup(createElement(FechaDato, { procedencia: P }))).not.toMatch(/title=|aria-hidden/);
  });


  it("sin la fecha, cuando la celda ya la dice; sin la hora en que se trajo, lo dice y no pinta <time> de hora", () => {
    expect(linea(pintar(createElement(FechaDato, { procedencia: P, sinFecha: true })))).toBe(textoProcedencia(P, { sinFecha: true }));
    const sinHora = pintar(createElement(FechaDato, { procedencia: { ...P, traidoEn: null }, etiqueta: "Cierre" }));
    expect(linea(sinHora)).toBe("Cierre 17-mar-2027 · Yahoo (BVC) · sin la hora en que se trajo");
    expect(tiempos(sinHora)).toEqual([["2027-03-17", "17-mar-2027"]]);
  });

  it("dato de más de un día hábil: el aviso «dato de hace N días hábiles», aparte de la línea; si no, nada", () => {
    const raiz = pintar(createElement(FechaDato, { procedencia: VIEJO, etiqueta: "Cierre" }));
    expect(texto(raiz.querySelector(".fecha-dato-aviso"))).toBe(avisoAtraso(VIEJO));
    expect(texto(raiz.querySelector(".fecha-dato-aviso"))).toBe("dato de hace 3 días hábiles");
    expect(linea(raiz)).toBe(textoProcedencia(VIEJO, { etiqueta: "Cierre" }));
    for (const h of [1, 0, null, undefined]) expect(pintar(createElement(FechaDato, { procedencia: { ...P, habilesAtras: h } })).querySelector(".fecha-dato-aviso"), String(h)).toBeNull();
  });

  it("un precio de la rueda dice el retraso DENTRO de la línea visible; un cierre, ninguno", () => {
    const raiz = pintar(createElement(FechaDato, { procedencia: { ...P, tipo: "RUEDA", horaDato: "11:42", traidoEn: "2027-03-17 11:44" } }));
    expect(linea(raiz)).toBe("Precio del 17-mar a las 11:42 · Yahoo (BVC) · hasta 20 min de retraso");
    expect(texto(raiz.querySelector(".fecha-dato-linea"))).toMatch(/hasta 20 min de retraso$/);
    expect(raiz.querySelectorAll(".fecha-dato-linea")).toHaveLength(1);
    const cierre = pintar(createElement(FechaDato, { procedencia: P, etiqueta: "Cierre" }));
    expect(linea(cierre)).not.toMatch(/retraso/);
  });

  it("es una nota: sin role, sin región viva y sin nada que se pueda tocar", () => {
    const html = renderToStaticMarkup(createElement(FechaDato, { procedencia: VIEJO }));
    expect(html).not.toMatch(/role=|aria-live|<a |<button|<input|<details|tabindex/i);
    expect(html).not.toMatch(/class="[^"]*\b(sr|cifra|nota|pill|chip)\b/);
  });
});

describe("FechaDatoCompuesta", () => {
  it("con fechas distintas: el cierre más antiguo y el aviso con las dos puntas", () => {
    const raiz = pintar(createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }));
    const aviso = raiz.querySelector(".fecha-dato-aviso");
    expect(linea(raiz)).toBe(textoCompuesta(MEZCLADAS));
    expect(texto(aviso)).toBe(avisoMezcladas(MEZCLADAS));
    expect(tiempos(raiz)).toEqual([["2021-03-01", "1-mar"], ["2021-03-02T18:40-05:00", "2-mar 18:40"], ["2021-03-01", "1-mar-2021"], ["2021-03-17", "17-mar-2021"]]);
  });

  it("todos del mismo día: sin aviso de fechas", () => {
    const raiz = pintar(createElement(FechaDatoCompuesta, { compuesta: MISMO_DIA }));
    expect(linea(raiz)).toBe(textoCompuesta(MISMO_DIA));
    expect(raiz.querySelector(".fecha-dato-aviso")).toBeNull();
  });

  it("el dato más viejo con más de un día hábil de atraso: el aviso de dato viejo", () => {
    const c: ProcedenciaCompuesta = { ...MISMO_DIA, masVieja: VIEJO };
    const avisos = [...pintar(createElement(FechaDatoCompuesta, { compuesta: c })).querySelectorAll(".fecha-dato-aviso")].map(texto);
    expect(avisos).toEqual(["dato de hace 3 días hábiles"]);
    const con = [...pintar(createElement(FechaDatoCompuesta, { compuesta: { ...MEZCLADAS, masVieja: { ...MEZCLADAS.masVieja, habilesAtras: 5 } } })).querySelectorAll(".fecha-dato-aviso")].map(texto);
    expect(con).toEqual([avisoMezcladas(MEZCLADAS), "dato de hace 5 días hábiles"]);
  });

  it("es una nota: sin role ni región viva", () => {
    expect(renderToStaticMarkup(createElement(FechaDatoCompuesta, { compuesta: MEZCLADAS }))).not.toMatch(/role=|aria-live|<a |<button|<details/i);
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
