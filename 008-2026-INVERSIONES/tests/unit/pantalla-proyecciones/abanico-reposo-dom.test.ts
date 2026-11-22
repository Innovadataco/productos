// @vitest-environment jsdom
// El abanico en reposo no trabaja de más (hallazgo MEDIO de react-reviewer y BAJO de code-reviewer, frente
// proyecciones-pantalla): terminada la interpolación, `useTransicion` devuelve otro arreglo con los mismos valores; el
// cuadro no se vuelve a armar en cada render (se compara por valores) ni se arma dos veces el mismo. Inventado.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { montar, movimiento, reloj, type Montaje } from "../graficas/dom";
import { PARAMETROS, puntosFicticios, resultadoFicticio } from "./ficticio";

const armado = vi.hoisted(() => ({ veces: 0 }));
vi.mock("@/app/proyecciones/abanico", async (original) => {
  const real = await original<typeof import("@/app/proyecciones/abanico")>();
  return { ...real, armarAbanico: (...a: Parameters<typeof real.armarAbanico>) => { armado.veces += 1; return real.armarAbanico(...a); } };
});

import { Abanico } from "@/app/proyecciones/GraficaAbanico";

const vista = (abre: number) => aVistaProyeccion(resultadoFicticio({ parametros: { ...PARAMETROS, horizonteMeses: 12 }, puntos: puntosFicticios(12, 46137.41, 211.37, abre) }));
const HISTORIA = [{ dia: "2027-02-26", valor: 45_793.29 }];

let m: Montaje;
beforeEach(() => { m = montar(); });
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Abanico en reposo", () => {
  it("terminada la interpolación, otro render con el mismo resultado no vuelve a armar el abanico", async () => {
    movimiento(false);
    const r = reloj();
    const [a, b] = [vista(97.13), vista(313.71)];
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: a }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: b }));
    await r.avanzar(16);
    await r.avanzar(1_000);
    await r.avanzar(16);
    armado.veces = 0;
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: b }));
    await m.pintar(createElement(Abanico, { historia: HISTORIA, vista: b }));
    expect(armado.veces).toBe(0);
  });
});
