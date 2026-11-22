// @vitest-environment jsdom
// «Cómo ha ido» en el tablero (frente graficas-tablero): valor frente al costo y TWR acumulada con un solo selector
// de rango arriba; la TWR del rango viene del servidor; el método y lo que no entra se dicen. Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import type { EvolucionVista } from "@/app/tablero/tipos";
import { montar, movimiento, texto, type Montaje } from "../graficas/dom";
import { D, dia, especie, resumenDe } from "./ficticio";
import { evolucionFicticia } from "./ficticio-graficas";

const vista = aVista(resumenDe([especie({ nemotecnico: "FICTA", cantidad: 19n, costoVivo: D(23503), cierre: { precio: D("1478.11"), fecha: dia("2027-03-31"), verificado: false } })]));
let m: Montaje;
beforeEach(() => {
  movimiento(true);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});

const seccion = () => m.contenedor.querySelector<HTMLElement>('section[aria-labelledby="t-evo"]')!;
const boton = (t: string) => [...seccion().querySelectorAll<HTMLButtonElement>("[role=group][aria-label='Rango de fechas'] button")].find((b) => texto(b) === t)!;
const pintar = (evolucion?: EvolucionVista | null) => m.pintar(createElement(Tablero, { vista, evolucion }));

describe("Cómo ha ido", () => {
  const evo = evolucionFicticia();
  const ultimo = evo.puntos[evo.puntos.length - 1]!;

  it("sin el dato (otras pruebas del tablero) no se pinta la sección", async () => {
    await pintar();
    expect(m.contenedor.querySelector('section[aria-labelledby="t-evo"]')).toBeNull();
  });

  it("dos gráficas con título y un selector de rango arriba que gobierna las dos; arranca en «Todo»", async () => {
    await pintar(evo);
    expect(texto(seccion().querySelector("h2"))).toBe("Cómo ha ido");
    expect([...seccion().querySelectorAll("figure .g-titulo")].map(texto)).toEqual(["Valor frente al costo de lo que tiene", "TWR acumulada"]);
    expect(boton("Todo").getAttribute("aria-pressed")).toBe("true");
    expect(texto(seccion().querySelector(".eyebrow"))).toBe("Del 4-ene-2027 al 31-mar-2027");
    // Lo que la historia no cubre sigue enfocable y dice por qué (hallazgo MEDIO de a11y-architect).
    expect(["1M", "3M", "6M", "1A"].map((t) => boton(t).getAttribute("aria-disabled"))).toEqual([null, "true", "true", "true"]);
    expect(texto(document.getElementById(boton("1A").getAttribute("aria-describedby")!))).toBe("La historia empieza el 4-ene-2027: no alcanza para ese rango.");
  });

  it("la leyenda da el valor y el costo del último día, igual que el servidor", async () => {
    await pintar(evo);
    const leyenda = texto(seccion().querySelector("figure .g-leyenda"));
    expect(leyenda).toContain(`Valor`);
    expect(leyenda).toContain(`Costo de lo que tiene`);
    expect(ultimo.costo).toBe("40571.1");
    expect(leyenda).toContain("$ 40.571");
  });

  it("al elegir 1M cambian el periodo y la TWR del rango (la del servidor), no la acumulada", async () => {
    await pintar(evo);
    const r1m = evo.rangos.find((r) => r.clave === "1M")!;
    await act(async () => boton("1M").click());
    expect(boton("1M").getAttribute("aria-pressed")).toBe("true");
    expect(texto(seccion().querySelector(".eyebrow"))).toBe("Del 1-mar-2027 al 31-mar-2027");
    // El cambio de rango se anuncia (hallazgo MEDIO de a11y-architect).
    expect(texto(seccion().querySelector("[role=status]"))).toBe("Mostrando 1M: del 1-mar-2027 al 31-mar-2027.");
    const encabezado = texto(seccion().querySelectorAll("figure")[1]!.querySelector("figcaption"));
    const pctTexto = (s: string | null) => s === null ? "—" : `${Number(s) > 0 ? "+" : Number(s) < 0 ? "−" : ""}${Math.abs(Number(s)).toFixed(1).replace(".", ",")} %`;
    expect(encabezado).toContain(`En el rango ${pctTexto(r1m.twrPct)}`);
    expect(encabezado).toContain(`Desde el inicio ${pctTexto(ultimo.twrPct)}`);
  });

  it("el texto alternativo lleva las cifras de las puntas del rango", async () => {
    await pintar(evo);
    const resumen = (k: number) => texto(document.getElementById(seccion().querySelectorAll("[role=slider]")[k]!.getAttribute("aria-describedby")!));
    expect(resumen(0)).toContain("Del 4-ene-2027 al 31-mar-2027");
    expect(resumen(0)).toContain("$ 23.503");
    expect(resumen(1)).toContain("TWR acumulada");
  });

  it("dice el método, que no es la cifra de Trii, los días que no se grafican y lo que no entra", async () => {
    await pintar(evo);
    const t = texto(seccion());
    expect(t).toContain("twr-acciones-v1");
    expect(t).toContain("por validar contra Trii");
    expect(evo.omitidos).toBe(3);
    expect(t).toContain("3 días no se grafican");
    expect(t).toContain("Sin ningún cierre (no entran): FICTZ");
  });

  it("al cargar, el anuncio del rango está vacío (solo habla al cambiarlo)", async () => {
    await pintar(evo);
    expect(texto(seccion().querySelector("[role=status]"))).toBe("");
  });

  it("una TWR de rango que el servidor no pudo calcular se escribe «—» (nunca Infinity)", async () => {
    await pintar({ ...evo, rangos: evo.rangos.map((r) => (r.clave === "TODO" ? { ...r, twrPct: null } : r)) });
    const encabezado = texto(seccion().querySelectorAll("figure")[1]!.querySelector("figcaption"));
    expect(encabezado).toContain("En el rango —");
    expect(encabezado).not.toMatch(/Infinity|NaN/);
  });

  it("si la evolución no se pudo calcular (null), lo dice y el resto del tablero sigue", async () => {
    await pintar(null);
    expect(texto(seccion())).toContain("No se pudo calcular la evolución");
    expect(m.contenedor.querySelector("h1")).not.toBeNull();
  });

  it("sin días con cierre de todas las especies, lo dice en vez de una gráfica vacía", async () => {
    await pintar({ ...evo, puntos: [], rangos: [], omitidos: 0, sinCierre: [] });
    expect(seccion().querySelector("figure")).toBeNull();
    expect(texto(seccion())).toContain("Todavía no hay un día con cierre de todas las especies que tiene");
  });
});
