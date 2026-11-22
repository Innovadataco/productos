// @vitest-environment jsdom
// El movimiento de la pantalla de proyecciones (frente proyecciones-pantalla), con cuadros a mano:
// - el abanico va del resultado anterior al nuevo por cuadros (interpolación, no salto), también si cambia el
//   horizonte; la leyenda y el deslizador dicen ya el resultado nuevo; con «reducir movimiento», salta;
// - las cifras cuentan hacia arriba al cargar (desde 0, ocultas hasta el primer cuadro) y, en un recálculo, desde la
//   cifra anterior; el lector de pantalla oye siempre la final. Inventado.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Abanico } from "@/app/proyecciones/GraficaAbanico";
import { Indicadores } from "@/app/proyecciones/Indicadores";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { montar, movimiento, reloj, texto, type Montaje } from "../graficas/dom";
import { PARAMETROS, puntosFicticios, resultadoFicticio } from "./ficticio";

const vista = (horizonteMeses: number, abre: number, o: Parameters<typeof resultadoFicticio>[0] = {}) =>
  aVistaProyeccion(resultadoFicticio({ parametros: { ...PARAMETROS, horizonteMeses }, puntos: puntosFicticios(horizonteMeses, 46137.41, 211.37, abre), ...o }));
const HISTORIA = [{ dia: "2027-02-26", valor: 45_793.29 }];
const A = vista(12, 97.13);
const B = vista(12, 313.71, { probabilidadBajoAportado: 0.2713 });

let m: Montaje;
beforeEach(() => { m = montar(); });
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const banda = () => m.contenedor.querySelector("path.g-banda-suave")!.getAttribute("d")!;
/** Las y de la banda (el alto P95 hacia adelante): sirven para comparar «entre» dos trazos. */
const ys = (d: string) => [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((x) => Number(x[2]));

describe("Abanico · interpolación", () => {
  it("de un resultado al otro por cuadros: a mitad de camino la banda está entre las dos; al final, en la nueva", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: A }));
    const desde = banda();
    const otra = montar();
    await otra.pintar(createElement(Abanico, { historia: HISTORIA, vista: B }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: B }));
    // La leyenda y el deslizador dicen ya el resultado nuevo.
    expect(m.contenedor.querySelector("[role=slider]")!.getAttribute("aria-valuetext")).toBe(otra.contenedor.querySelector("[role=slider]")!.getAttribute("aria-valuetext"));
    await r.avanzar(16);
    await r.avanzar(300);
    const medio = banda();
    expect(medio).not.toBe(desde);
    await r.avanzar(700);
    await r.avanzar(16);
    const hasta = banda();
    const y0 = ys(desde), y1 = ys(hasta), ym = ys(medio);
    // El punto más abierto (P95 del último mes) queda entre el de antes y el de después.
    const k = y1.length >> 1;
    expect(Math.min(y0[k]!, y1[k]!) <= ym[k]! && ym[k]! <= Math.max(y0[k]!, y1[k]!)).toBe(true);
    expect(ym[k]).not.toBe(y1[k]);
    otra.desmontar();
  });

  it("si cambia el horizonte, el abanico crece desde el último mes (no salta ni queda vacío)", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: A }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: vista(37, 97.13) }));
    await r.avanzar(16);
    expect(banda()).toMatch(/^M.+Z$/);
    expect(m.contenedor.querySelectorAll("tbody tr")).toHaveLength(0);
  });

  it("con «reducir movimiento», el cambio es inmediato", async () => {
    movimiento(true);
    const otra = montar();
    await otra.pintar(createElement(Abanico, { historia: HISTORIA, vista: B }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: A }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: B }));
    expect(banda()).toBe(otra.contenedor.querySelector("path.g-banda-suave")!.getAttribute("d"));
    otra.desmontar();
  });

  it("el resumen de la gráfica dice las cifras del final y la historia", async () => {
    movimiento(true);
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: A }));
    const resumen = texto(document.getElementById(m.contenedor.querySelector("[role=slider]")!.getAttribute("aria-describedby")!));
    expect(resumen).toContain("26-feb-2027");
    expect(resumen).toContain("1 año");
    expect(resumen).toContain(`$ ${String(A.final.p95).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`);
  });
});

describe("Indicadores · cuenta hacia arriba", () => {
  const cifra = (k: number) => m.contenedor.querySelectorAll(".proy-indicador")[k]!.querySelector<HTMLElement>(".cifra")!;

  it("al cargar cuenta desde 0 (oculta hasta el primer cuadro); el lector oye la final", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Indicadores, { vista: A, calculando: false }));
    expect(cifra(2).dataset.fase).toBe("espera");
    expect(texto(m.contenedor.querySelectorAll(".proy-indicador")[2]!.querySelector(".sr"))).toBe("Probabilidad de terminar por debajo de lo aportado: 13,7 %");
    await r.avanzar(16);
    await r.avanzar(400);
    expect(cifra(2).dataset.fase).toBe("anima");
    expect(texto(cifra(2))).not.toBe("13,7 %");
    await r.avanzar(2_000);
    expect(cifra(2).dataset.fase).toBe("fin");
    expect(texto(cifra(2))).toBe("13,7 %");
  });

  it("en un recálculo cuenta desde la cifra anterior, sin volver a ocultarse", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Indicadores, { vista: A, calculando: false }));
    await r.avanzar(16);
    await r.avanzar(3_000);
    await m.pintar(createElement(Indicadores, { vista: B, calculando: false }));
    await r.avanzar(16);
    await r.avanzar(300);
    expect(cifra(2).dataset.fase).toBe("anima");
    const n = Number(texto(cifra(2)).replace(" %", "").replace(",", "."));
    expect(n).toBeGreaterThan(13.7);
    expect(n).toBeLessThan(27.1);
    await r.avanzar(3_000);
    expect(texto(cifra(2))).toBe("27,1 %");
  });

  it("con «reducir movimiento», la cifra final de una (sin ocultarse)", async () => {
    movimiento(true);
    await m.pintar(createElement(Indicadores, { vista: A, calculando: false }));
    expect(cifra(2).dataset.fase).toBe("fin");
    expect(texto(cifra(2))).toBe("13,7 %");
  });

  it("sin resultado, «—»", async () => {
    movimiento(true);
    await m.pintar(createElement(Indicadores, { vista: null, calculando: true }));
    expect(texto(cifra(0))).toBe("—");
  });
});
