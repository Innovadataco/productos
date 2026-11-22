// Escalas del módulo de gráficas (frente graficas-tablero). Puro.
import { describe, expect, it } from "vitest";
import { barrasDivergentes, dominioY, escalaLineal, ticksBonitos } from "@/app/_graficas/escalas";

describe("escalaLineal", () => {
  it("lleva el dominio al rango y vuelve", () => {
    const e = escalaLineal([10, 20], [0, 1000]);
    expect(e.a(15)).toBe(500);
    expect(e.de(250)).toBe(12.5);
  });
  it("un dominio sin ancho no divide por cero: todo cae en el centro del rango", () => {
    const e = escalaLineal([7, 7], [0, 200]);
    expect(e.a(7)).toBe(100);
    expect(e.de(37)).toBe(7);
  });
  it("puede invertirse (y crece hacia abajo en pantalla)", () => {
    expect(escalaLineal([0, 100], [220, 0]).a(25)).toBe(165);
  });
});

describe("ticksBonitos", () => {
  it("pasos de 1, 2 o 5 por potencia de 10", () => {
    expect(ticksBonitos(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(ticksBonitos(262000, 271000, 4)).toEqual([262000, 264000, 266000, 268000, 270000]);
    expect(ticksBonitos(-3.7, 4.1, 4)).toEqual([-2, 0, 2, 4]);
  });
  it("un dominio vacío o al revés da un solo tick o ninguno", () => {
    expect(ticksBonitos(5, 5, 4)).toEqual([5]);
    expect(ticksBonitos(9, 1, 4)).toEqual([]);
    expect(ticksBonitos(0, Number.NaN, 4)).toEqual([]);
  });
});

describe("dominioY", () => {
  it("extiende a pasos bonitos que contienen todos los valores (ignora null)", () => {
    expect(dominioY([262913, null, 268090, 265000], { cuantos: 4 })).toEqual([262000, 270000]);
  });
  it("incluirCero lleva el cero adentro", () => {
    expect(dominioY([3.1, 7.9], { cuantos: 4, incluirCero: true })).toEqual([0, 8]);
    expect(dominioY([-4.6, -1.3], { cuantos: 4, incluirCero: true })).toEqual([-5, 0]);
  });
  it("sin valores o con uno solo da un dominio con ancho", () => {
    expect(dominioY([], { cuantos: 4 })).toEqual([0, 1]);
    expect(dominioY([1237], { cuantos: 4 })).toEqual([1236, 1238]);
    expect(dominioY([0], { cuantos: 4 })).toEqual([-1, 1]);
  });
});

describe("barrasDivergentes", () => {
  it("el cero queda donde corresponde y cada barra crece desde él (porcentajes del ancho, 2 decimales)", () => {
    expect(barrasDivergentes([10, -5])).toEqual({ cero: 33.33, barras: [{ izquierda: 33.33, ancho: 66.67 }, { izquierda: 0, ancho: 33.33 }] });
  });
  it("todas positivas: el cero a la izquierda; todas en cero: sin ancho", () => {
    expect(barrasDivergentes([3, 1])).toEqual({ cero: 0, barras: [{ izquierda: 0, ancho: 100 }, { izquierda: 0, ancho: 33.33 }] });
    expect(barrasDivergentes([0, 0])).toEqual({ cero: 0, barras: [{ izquierda: 0, ancho: 0 }, { izquierda: 0, ancho: 0 }] });
    expect(barrasDivergentes([-2, -8]).cero).toBe(100);
  });
});
