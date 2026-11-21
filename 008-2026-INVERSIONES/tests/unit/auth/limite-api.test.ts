// Tope general de las API por IP (requisito #10 del CEO de PI): 60 por minuto; el pedido 61 recibe 429
// con Retry-After. La memoria está acotada aunque lleguen muchas IP distintas.
import { describe, expect, it } from "vitest";
import { crearLimitador } from "@/auth/limite-api";

const T0 = 1_000_000;

describe("crearLimitador", () => {
  it("deja pasar 60 en la ventana y frena el 61 con los segundos que faltan", () => {
    const l = crearLimitador({ maximo: 60, ventanaMs: 60_000 });
    for (let k = 0; k < 60; k += 1) expect(l.registrar("203.0.113.1/32", T0 + k).permitido).toBe(true);
    expect(l.registrar("203.0.113.1/32", T0 + 20_000)).toEqual({ permitido: false, reintentarEnS: 40 });
  });

  it("cada red lleva su propia cuenta", () => {
    const l = crearLimitador({ maximo: 2, ventanaMs: 60_000 });
    l.registrar("a", T0);
    l.registrar("a", T0);
    expect(l.registrar("a", T0).permitido).toBe(false);
    expect(l.registrar("b", T0).permitido).toBe(true);
  });

  it("al pasar la ventana vuelve a contar de cero", () => {
    const l = crearLimitador({ maximo: 1, ventanaMs: 60_000 });
    expect(l.registrar("a", T0).permitido).toBe(true);
    expect(l.registrar("a", T0 + 59_999).permitido).toBe(false);
    expect(l.registrar("a", T0 + 60_000).permitido).toBe(true);
  });

  it("no guarda más redes que el tope de memoria", () => {
    const l = crearLimitador({ maximo: 5, ventanaMs: 60_000, maxRedes: 100 });
    for (let k = 0; k < 1000; k += 1) l.registrar(`red-${k}`, T0);
    expect(l.tamano()).toBeLessThanOrEqual(100);
  });
});
