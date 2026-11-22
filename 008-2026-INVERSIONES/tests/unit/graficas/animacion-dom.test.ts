// @vitest-environment jsdom
// Movimiento de las gráficas (frente graficas-tablero): «reducir movimiento» se respeta y se sigue en vivo; la
// interpolación corre por cuadros, salta si el largo cambia o la pestaña no se ve, y se cancela al desmontar.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMovimientoReducido, useTransicion } from "@/app/_graficas";
import { cambiarMovimiento, montar, movimiento, reloj, type Montaje } from "./dom";

let m: Montaje;
let visto: readonly number[] = [];
let reducido: boolean | null = null;
function Sonda({ objetivo }: { objetivo: readonly number[] }) {
  visto = useTransicion(objetivo, 400);
  reducido = useMovimientoReducido();
  return null;
}

beforeEach(() => {
  m = montar();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMovimientoReducido", () => {
  it("sigue la preferencia del sistema en vivo", async () => {
    movimiento(false);
    await m.pintar(createElement(Sonda, { objetivo: [1] }));
    expect(reducido).toBe(false);
    await cambiarMovimiento(true);
    expect(reducido).toBe(true);
  });
});

describe("useTransicion", () => {
  it("con «reducir movimiento» devuelve el objetivo de una", async () => {
    movimiento(true);
    reloj();
    await m.pintar(createElement(Sonda, { objetivo: [0, 10] }));
    await m.pintar(createElement(Sonda, { objetivo: [100, 20] }));
    expect(visto).toEqual([100, 20]);
  });

  it("sin reducir, va de a poco por cuadros hasta el objetivo exacto", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Sonda, { objetivo: [0, 10] }));
    expect(visto).toEqual([0, 10]);
    await m.pintar(createElement(Sonda, { objetivo: [100, 20] }));
    await r.avanzar(16);
    await r.avanzar(100);
    expect(visto[0]).toBeGreaterThan(0);
    expect(visto[0]).toBeLessThan(100);
    await r.avanzar(1000);
    expect(visto).toEqual([100, 20]);
  });

  it("si el largo cambia o la pestaña no se ve, salta sin animar", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Sonda, { objetivo: [0, 10] }));
    await m.pintar(createElement(Sonda, { objetivo: [5, 6, 7] }));
    expect(visto).toEqual([5, 6, 7]);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    await m.pintar(createElement(Sonda, { objetivo: [8, 9, 10] }));
    await r.avanzar(16);
    expect(visto).toEqual([8, 9, 10]);
  });

  it("al desmontar a mitad de camino cancela el cuadro pendiente", async () => {
    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(Sonda, { objetivo: [0] }));
    await m.pintar(createElement(Sonda, { objetivo: [50] }));
    expect(r.pendientes()).toBeGreaterThan(0);
    m.desmontar();
    expect(r.pendientes()).toBe(0);
  });

  it("sin requestAnimationFrame (entorno sin dibujo) salta al objetivo", async () => {
    movimiento(false);
    vi.stubGlobal("requestAnimationFrame", undefined);
    await m.pintar(createElement(Sonda, { objetivo: [0] }));
    await m.pintar(createElement(Sonda, { objetivo: [50] }));
    expect(visto).toEqual([50]);
  });
});
