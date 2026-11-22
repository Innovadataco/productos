// La mira y el teclado de las gráficas de tiempo (frente graficas-tablero). Puro.
import { describe, expect, it } from "vitest";
import { indiceCercano, indiceTrasTecla } from "@/app/_graficas/interaccion";

describe("indiceCercano", () => {
  const xs = [0, 10, 20, 30, 40];
  it("el punto más cercano a x, dentro de la ventana", () => {
    expect(indiceCercano(xs, 14, { desde: 0, hasta: 4 })).toBe(1);
    expect(indiceCercano(xs, 16, { desde: 0, hasta: 4 })).toBe(2);
    expect(indiceCercano(xs, -7, { desde: 0, hasta: 4 })).toBe(0);
    expect(indiceCercano(xs, 99, { desde: 0, hasta: 4 })).toBe(4);
    expect(indiceCercano(xs, 1, { desde: 2, hasta: 3 })).toBe(2);
    expect(indiceCercano(xs, 99, { desde: 2, hasta: 3 })).toBe(3);
  });
});

describe("indiceTrasTecla", () => {
  const v = { desde: 10, hasta: 59 };
  it.each([
    ["ArrowRight", 20, 21], ["ArrowLeft", 20, 19], ["ArrowRight", 59, 59], ["ArrowLeft", 10, 10],
    ["Home", 30, 10], ["End", 30, 59], ["PageUp", 30, 25], ["PageDown", 30, 35], ["PageDown", 57, 59],
    // Como deslizador (patrón APG): ↑ avanza y ↓ retrocede.
    ["ArrowUp", 20, 21], ["ArrowDown", 20, 19],
  ])("%s desde %s → %s", (tecla, actual, esperado) => {
    expect(indiceTrasTecla(tecla, actual, v)).toBe(esperado);
  });
  it("sin punto activo, las flechas empiezan por el último; otra tecla no hace nada", () => {
    expect(indiceTrasTecla("ArrowLeft", null, v)).toBe(59);
    expect(indiceTrasTecla("Enter", 30, v)).toBeNull();
  });
});
