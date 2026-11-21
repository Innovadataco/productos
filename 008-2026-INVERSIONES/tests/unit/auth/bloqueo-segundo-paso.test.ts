// Bloqueo del segundo paso (decisión D2 de la GATE 1): quien llega aquí ya tiene la clave, así que cada
// bloqueo que llega antes de 24 h del fin del anterior sube un nivel y dura el doble: 15 min, 30, 60… hasta
// 24 h (la cadena completa contra la base está en tests/integracion/auth-totp-segundo-paso.test.ts).
// El bloqueo del paso de la clave sigue fijo en 15 min (src/auth/ingreso.ts).
import { describe, expect, it } from "vitest";
import { duracionBloqueoSegundoPaso } from "@/auth/fallos-segundo-paso";
import { BLOQUEO_MAX_MS, BLOQUEO_MS, FALLOS_SEGUNDO_PASO } from "@/auth/limites";

const MIN = 60_000;

describe("duracionBloqueoSegundoPaso", () => {
  it.each([
    [0, 15],
    [1, 30],
    [2, 60],
    [3, 120],
    [4, 240],
    [5, 480],
    [6, 960],
  ])("el nivel %i dura %i min", (nivel, minutos) => {
    expect(duracionBloqueoSegundoPaso(nivel)).toBe(minutos * MIN);
  });

  it("tiene tope de 24 h, también en niveles altos", () => {
    expect(duracionBloqueoSegundoPaso(7)).toBe(BLOQUEO_MAX_MS);
    expect(duracionBloqueoSegundoPaso(1000)).toBe(BLOQUEO_MAX_MS);
    expect(BLOQUEO_MAX_MS).toBe(24 * 60 * MIN);
  });

  it("el primero dura lo mismo que el de la clave, y bloquean 5 fallos", () => {
    expect(duracionBloqueoSegundoPaso(0)).toBe(BLOQUEO_MS);
    expect(FALLOS_SEGUNDO_PASO).toBe(5);
  });

  it("un nivel negativo es el primero y uno inválido, el peor caso", () => {
    expect(duracionBloqueoSegundoPaso(-1)).toBe(BLOQUEO_MS);
    expect(duracionBloqueoSegundoPaso(Number.NaN)).toBe(BLOQUEO_MAX_MS);
  });
});
