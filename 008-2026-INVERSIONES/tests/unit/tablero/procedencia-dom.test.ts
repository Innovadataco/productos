// @vitest-environment jsdom
// El tablero dice de dónde y de cuándo es cada dato (frente fecha-hora-datos):
// - cada fila (celda «Cierre»), el panel de detalle, cada barra y cada tarjeta de «Qué movió»: el cierre, cuándo lo
//   trajo 008 (hora de Colombia) y la fuente;
// - los valores que suman cierres (el total «¿Gano?», «Valor en acciones», la composición y el neto de «Qué movió»): el
//   cierre MÁS VIEJO que los compone y, si hay fechas distintas, el aviso. Esa fecha es la de `cierreMasViejo`.
// Datos inventados: FICTA y FICTB cerraron el 31-mar-2027; FICTC, ilíquida, el 12-mar-2027 (otra fuente).
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { fecha } from "@/app/tablero/formato";
import { montar, movimiento, texto, type Montaje } from "../graficas/dom";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

const cierre = (precio: string, iso: string, traidoEn: string, fuente = "yahoo") => ({ precio: D(precio), fecha: dia(iso), verificado: false, traidoEn: new Date(traidoEn), fuente });
const MEZCLADAS = aVista(resumenDe([
  especie({ nemotecnico: "FICTA", cantidad: 13n, costoVivo: D(4613), cierre: cierre("317.41", "2027-03-31", "2027-03-31T23:04:00Z"), serie: [punto("2027-03-30", 301.19), punto("2027-03-31", 317.41)] }),
  especie({ nemotecnico: "FICTB", cantidad: 7n, costoVivo: D(7919), cierre: cierre("1211.09", "2027-03-31", "2027-04-01T12:13:00Z"), serie: [punto("2027-03-30", 1237.53), punto("2027-03-31", 1211.09)] }),
  especie({ nemotecnico: "FICTC", cantidad: 5n, costoVivo: D(1237), cierre: cierre("503.17", "2027-03-12", "2027-03-12T22:41:00Z", "bvc-ficticia"), serie: [punto("2027-03-12", 503.17)] }),
  especie({ nemotecnico: "FICTD", cantidad: 3n, costoVivo: D(911) }),
]));
const MISMO_DIA = aVista(resumenDe([
  especie({ nemotecnico: "FICTA", cantidad: 13n, costoVivo: D(4613), cierre: cierre("317.41", "2027-03-31", "2027-03-31T23:04:00Z") }),
  especie({ nemotecnico: "FICTB", cantidad: 7n, costoVivo: D(7919), cierre: cierre("1211.09", "2027-03-31", "2027-04-01T12:13:00Z") }),
]));

const TRAIDO_A = "traído 18:04 · Yahoo (BVC)";
const TRAIDO_B = "traído 1-abr 07:13 · Yahoo (BVC)";
const TRAIDO_C = "traído 17:41 · bvc-ficticia";
const COMPUESTA = "Cierre más antiguo 12-mar · traído 17:41 · bvc-ficticia y Yahoo (BVC)";
const AVISO = "Cierres de fechas distintas: del 12-mar-2027 al 31-mar-2027.";

let m: Montaje;
beforeEach(() => {
  movimiento(true);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});

const fila = (nemo: string) => [...m.contenedor.querySelectorAll("tbody tr")].find((tr) => texto(tr.querySelector("button")) === nemo)!;
const celdaCierre = (nemo: string) => fila(nemo).querySelectorAll("td")[2]!;
const kpi = (nombre: string) => [...m.contenedor.querySelectorAll(".kpi")].find((k) => texto(k.querySelector(".eyebrow")) === nombre)!;
const seccion = (titulo: string) => m.contenedor.querySelector<HTMLElement>(`section[aria-labelledby="${titulo}"]`)!;
// La línea visible de cada nota (el detalle accesible y los avisos tienen sus propias clases).
const notas = (el: Element) => [...el.querySelectorAll(".fecha-dato-linea")].map(texto);
// La línea y, si los hay, los avisos de la misma nota (fechas distintas, dato viejo).
const notasConAvisos = (el: Element) => [...el.querySelectorAll(".fecha-dato")].map((n) => [texto(n.querySelector(".fecha-dato-linea")), ...[...n.querySelectorAll(".fecha-dato-aviso")].map(texto)].join(" "));

describe("cada dato con su procedencia", () => {
  it("la celda «Cierre» de cada fila: cuándo lo trajo 008 y la fuente (la fecha ya la dice el chip)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    expect(notas(celdaCierre("FICTA"))).toEqual([TRAIDO_A]);
    expect(notas(celdaCierre("FICTB"))).toEqual([TRAIDO_B]);
    expect(notas(celdaCierre("FICTC"))).toEqual([TRAIDO_C]);
    expect(texto(celdaCierre("FICTC"))).toContain("precio del 12-mar-2027 · sin verificar");
  });

  it("una especie sin cierre no inventa procedencia", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    expect(notas(fila("FICTD"))).toEqual([]);
  });

  it("el panel de detalle: cuándo se trajo y de dónde, en el mismo par que «Valor al cierre del …» (revisión a11y, MEDIO)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const boton = fila("FICTB").querySelector("button")!;
    await act(async () => boton.click());
    const panel = m.contenedor.querySelector('aside[aria-label="Detalle de FICTB"]')!;
    expect(notas(panel)).toEqual([TRAIDO_B]);
    // Una segunda definición del mismo término: el lector la oye como parte del valor al cierre.
    const dd = panel.querySelector(".fecha-dato")!.closest("dd")!;
    expect(texto(dd.previousElementSibling?.previousElementSibling)).toBe("Valor al cierre del 31-mar-2027");
    expect(dd.previousElementSibling?.tagName).toBe("DD");
  });

  it("cada barra conserva su detalle corto, sin la procedencia: el nombre del botón no se alarga ni se sale a 375 px (revisión a11y, ALTO y MEDIO)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const barras = [...seccion("t-foto").querySelectorAll("button.g-barra")];
    expect(barras.length).toBe(3);
    for (const b of barras) expect(texto(b)).not.toMatch(/traído|hora de Colombia|BVC por Yahoo|bvc-ficticia/);
  });

  it("cada tarjeta de «Qué movió»: cuándo se trajo su cierre y de dónde (la fecha la dice el periodo de la sección)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const tarjetas = [...seccion("t-mov").querySelectorAll('[role="listitem"]')];
    const de = (nemo: string) => notas(tarjetas.find((t) => texto(t.querySelector("b")) === nemo)!);
    expect(de("FICTA")).toEqual([TRAIDO_A]);
    expect(de("FICTB")).toEqual([TRAIDO_B]);
  });
});

describe("los valores que suman cierres", () => {
  it("«Valor en acciones»: el cierre más antiguo que lo compone y el aviso de fechas distintas", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    expect(notasConAvisos(kpi("Valor en acciones"))).toEqual([`${COMPUESTA} ${AVISO}`]);
  });

  it("la fecha que dice es la del cierre más viejo del tablero", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    expect(kpi("Valor en acciones").querySelector(".fecha-dato time")?.getAttribute("datetime")).toBe(MEZCLADAS.cierreMasViejo);
  });

  it("en la portada va una sola vez, junto a «Valor en acciones», y nunca dentro del título (revisión react y a11y, MEDIO)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const hero = seccion("t-hero");
    expect(hero.querySelector("h1 .fecha-dato")).toBeNull();
    expect(notasConAvisos(hero)).toEqual([`${COMPUESTA} ${AVISO}`]);
    expect(hero.querySelector(".fecha-dato")!.closest(".kpi")).toBe(kpi("Valor en acciones"));
  });

  it("la composición del portafolio (debajo de las gráficas, no en su centro)", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const foto = seccion("t-foto");
    expect(foto.querySelector(".g-centro .fecha-dato")).toBeNull();
    expect(notasConAvisos(foto).filter((t) => t.startsWith("Cierre más antiguo"))).toEqual([`${COMPUESTA} ${AVISO}`]);
  });

  it("el neto de «Qué movió»: solo las que entraron (todas del día de la referencia), sin aviso", async () => {
    await m.pintar(createElement(Tablero, { vista: MEZCLADAS }));
    const mov = seccion("t-mov");
    const compuesta = [...mov.querySelectorAll(".fecha-dato-linea")].filter((n) => n.closest('[role="listitem"]') === null).map(texto);
    expect(compuesta).toEqual([`Cierre 31-mar · ${TRAIDO_A}`]);
    expect(mov.querySelector(".fecha-dato-aviso")).toBeNull();
  });

  it("todas del mismo día: el cierre de ese día y ningún aviso de fechas distintas", async () => {
    await m.pintar(createElement(Tablero, { vista: MISMO_DIA }));
    expect(notas(kpi("Valor en acciones"))).toEqual([`Cierre 31-mar · ${TRAIDO_A}`]);
    expect(m.contenedor.querySelector(".fecha-dato-aviso")).toBeNull();
  });

  it("sin ningún cierre no hay procedencia que mostrar", async () => {
    await m.pintar(createElement(Tablero, { vista: aVista(resumenDe([especie({ nemotecnico: "FICTD", cantidad: 3n, costoVivo: D(911) })])) }));
    expect(m.contenedor.querySelector(".fecha-dato")).toBeNull();
  });
});
