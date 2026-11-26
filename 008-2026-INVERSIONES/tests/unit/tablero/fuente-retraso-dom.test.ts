// @vitest-environment jsdom
// El tablero dice qué tan viejo es cada cierre y de dónde vienen los precios (frente fuente-retraso):
// - un cierre con más de un día hábil de antigüedad según el calendario de la BVC lo avisa («dato de hace N días
//   hábiles»), en su fila, en el detalle y en el valor que suma (por su cierre más viejo); uno al día, no;
// - sin calendario que cubra el tramo, no se inventa el número;
// - el pie dice la fuente, el retraso en rueda y que no es tiempo real.
// Datos inventados de 2027: FICTA cerró el miércoles 31-mar; FICTC, ilíquida, el viernes 12-mar. El 22-mar y el 29-mar
// (festivos de la semana) se siembran en el calendario; las horas son de Colombia (UTC−5).
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { leerCalendario } from "@/precios/negociacion";
import { pieDePrecios } from "@/precios/fuentes";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { montar, movimiento, texto, type Montaje } from "../graficas/dom";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

const cierre = (precio: string, iso: string, traidoEn: string, fuente = "yahoo") => ({ precio: D(precio), fecha: dia(iso), verificado: false, traidoEn: new Date(traidoEn), fuente });
const RESUMEN = resumenDe([
  especie({ nemotecnico: "FICTA", cantidad: 13n, costoVivo: D(4613), cierre: cierre("317.41", "2027-03-31", "2027-03-31T23:04:00Z"), serie: [punto("2027-03-30", 301.19), punto("2027-03-31", 317.41)] }),
  especie({ nemotecnico: "FICTC", cantidad: 5n, costoVivo: D(1237), cierre: cierre("503.17", "2027-03-12", "2027-03-12T22:41:00Z", "bvc-ficticia"), serie: [punto("2027-03-12", 503.17)] }),
]);
const CALENDARIO = leerCalendario([
  { dia: dia("2027-03-22"), esHabil: false }, { dia: dia("2027-03-29"), esHabil: false }, { dia: dia("2027-04-01"), esHabil: true },
]);
const bogota = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00-05:00`);
/** Martes 6-abr-2027, 10:00: del 31-mar quedan el jue 1, el vie 2 y el lun 5 (3 días hábiles; hoy no cerró). */
const MARTES = bogota("2027-04-06", "10:00");
const VISTA = aVista(RESUMEN, { ahora: MARTES, calendario: CALENDARIO });

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
const avisos = (el: Element) => [...el.querySelectorAll(".fecha-dato-aviso")].map(texto);

describe("aVista cuenta los días hábiles de atraso de cada cierre", () => {
  it("FICTA: 3 (el cierre del 31-mar contra el martes 6-abr a las 10:00); FICTC: los de 12-mar a 5-abr sin los festivos", () => {
    const [a, c] = VISTA.filas;
    expect(a?.cierre?.habilesAtras).toBe(3);
    // 15–19 (5), 23–26 (4; el 22 fue festivo), 30-mar a 2-abr (4; el 29 fue festivo) y el 5-abr (1): 14.
    expect(c?.cierre?.habilesAtras).toBe(14);
  });

  it("sin el contexto (las pantallas que no lo piden), el cierre no trae el número", () => {
    expect(aVista(RESUMEN).filas[0]?.cierre).not.toHaveProperty("habilesAtras");
  });

  it("al día (el jueves 1-abr a las 10:00 aún no cerró la rueda del 1): sin número que avisar", () => {
    expect(aVista(RESUMEN, { ahora: bogota("2027-04-01", "10:00"), calendario: CALENDARIO }).filas[0]?.cierre?.habilesAtras).toBeNull();
  });

  it("un calendario que no cubre el año del tramo: cuenta los días de semana (cota superior) y lo marca aproximado", () => {
    const sin = leerCalendario([{ dia: dia("2026-01-01"), esHabil: false }]);
    const [a, c] = aVista(RESUMEN, { ahora: MARTES, calendario: sin }).filas;
    expect(a?.cierre?.habilesAtras).toBe(3); // jue 1, vie 2 y lun 5-abr
    expect(a?.cierre?.aniosSinFestivos).toEqual([2027]);
    expect(c?.cierre?.habilesAtras).toBe(16); // sin descontar los festivos del 22 y el 29-mar
  });

  it("con el calendario completo, el cierre no trae años sin festivos", () => {
    expect(VISTA.filas[0]?.cierre).not.toHaveProperty("aniosSinFestivos");
  });
});

describe("la pantalla avisa el dato viejo", () => {
  it("la celda del cierre y el detalle de cada especie", async () => {
    await m.pintar(createElement(Tablero, { vista: VISTA }));
    expect(avisos(fila("FICTA"))).toEqual(["dato de hace 3 días hábiles"]);
    expect(avisos(fila("FICTC"))).toEqual(["dato de hace 14 días hábiles"]);
  });

  it("el valor que suma cierres avisa por el más viejo (FICTC)", async () => {
    await m.pintar(createElement(Tablero, { vista: VISTA }));
    const kpi = [...m.contenedor.querySelectorAll(".kpi")].find((k) => texto(k.querySelector(".eyebrow")) === "Valor en acciones")!;
    expect(avisos(kpi)).toEqual(["Cierres de fechas distintas: del 12-mar-2027 al 31-mar-2027.", "dato de hace 14 días hábiles"]);
  });

  it("con un solo día hábil de atraso (el 1-abr a las 18:00): ningún aviso de dato viejo", async () => {
    const vista = aVista(RESUMEN, { ahora: bogota("2027-04-01", "18:00"), calendario: CALENDARIO });
    await m.pintar(createElement(Tablero, { vista }));
    expect(avisos(fila("FICTA"))).toEqual([]);
  });
});

describe("la pantalla avisa el dato viejo aproximado", () => {
  it("«unos N días hábiles (sin festivos de 2027 en el calendario)», en la fila y en el valor que suma", async () => {
    const sin = leerCalendario([{ dia: dia("2026-01-01"), esHabil: false }]);
    await m.pintar(createElement(Tablero, { vista: aVista(RESUMEN, { ahora: MARTES, calendario: sin }) }));
    expect(avisos(fila("FICTA"))).toEqual(["dato de hace unos 3 días hábiles (sin festivos de 2027 en el calendario)"]);
    const kpi = [...m.contenedor.querySelectorAll(".kpi")].find((k) => texto(k.querySelector(".eyebrow")) === "Valor en acciones")!;
    expect(avisos(kpi).at(-1)).toBe("dato de hace unos 16 días hábiles (sin festivos de 2027 en el calendario)");
  });
});

describe("el pie de las fuentes", () => {
  it("dice la fuente, el retraso en rueda y que no es tiempo real", async () => {
    await m.pintar(createElement(Tablero, { vista: VISTA }));
    expect(m.contenedor.querySelector("#fuentes-de-precios")).toBeNull();
    const pie = [...m.contenedor.querySelectorAll("p.nota")].find((p) => texto(p).startsWith("Precios:"));
    expect(texto(pie)).toBe("Precios: Yahoo (BVC), cierre diario; durante la rueda, hasta 20 min de retraso. No es tiempo real.");
    expect(texto(pie)).toBe(pieDePrecios());
    expect(prohibidasEn(texto(pie))).toEqual([]);
  });
});
