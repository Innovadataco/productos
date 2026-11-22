// Rutas SVG del módulo de gráficas (frente graficas-tablero): línea con huecos, área entre dos curvas, región para
// recortar arriba o abajo de una curva y tajadas de la dona. Puro; coordenadas con 1 decimal.
import { describe, expect, it } from "vitest";
import { rutaArea, rutaLinea, rutaRegion, tajadasDona } from "@/app/_graficas/trazos";

const p = (x: number, y: number | null) => ({ x, y });

describe("rutaLinea", () => {
  it("une los puntos y corta en los null", () => {
    expect(rutaLinea([p(0, 10), p(50.04, 20.06), p(100, null), p(150, 5)])).toBe("M0,10L50,20.1M150,5");
  });
  it("sin puntos, ruta vacía", () => {
    expect(rutaLinea([])).toBe("");
  });
});

describe("rutaArea", () => {
  it("cierra la curva de arriba hacia adelante y la de abajo hacia atrás, por tramos sin null", () => {
    expect(rutaArea([p(0, 10), p(50, 20)], [p(0, 40), p(50, 30)])).toBe("M0,10L50,20L50,30L0,40Z");
    expect(rutaArea([p(0, 10), p(50, null), p(100, 12), p(150, 13)], [p(0, 40), p(50, 30), p(100, 31), p(150, 32)])).toBe("M0,10L0,40ZM100,12L150,13L150,32L100,31Z");
  });
});

describe("rutaRegion", () => {
  it("la curva y su borde (arriba = 0, abajo = el alto) para usarla como recorte", () => {
    expect(rutaRegion([p(0, 10), p(50, 20)], 0)).toBe("M0,10L50,20L50,0L0,0Z");
    expect(rutaRegion([p(0, 10), p(50, null), p(80, 20)], 220)).toBe("M0,10L80,20L80,220L0,220Z");
    expect(rutaRegion([], 0)).toBe("");
  });
});

describe("tajadasDona", () => {
  it("reparte la circunferencia por valor y deja un hueco entre tajadas", () => {
    const t = tajadasDona([3, 1], 100, 2);
    expect(t).toEqual([{ inicio: 1, largo: 73 }, { inicio: 76, largo: 23 }]);
  });
  it("una sola tajada da la vuelta completa sin hueco; un valor 0 o negativo no pinta", () => {
    expect(tajadasDona([4613], 100, 2)).toEqual([{ inicio: 0, largo: 100 }]);
    expect(tajadasDona([0, 5], 100, 2)).toEqual([{ inicio: 0, largo: 0 }, { inicio: 0, largo: 100 }]);
    expect(tajadasDona([0, 0], 100, 2)).toEqual([{ inicio: 0, largo: 0 }, { inicio: 0, largo: 0 }]);
  });
});
