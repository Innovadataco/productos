// Percentiles (tipo 7, interpolación lineal, el de NumPy y R por defecto) y la media/desviación. Puro.
import { describe, expect, it } from "vitest";
import { desviacion, media, percentil } from "@/proyecciones/estadistica";

describe("percentil (tipo 7)", () => {
  const datos = Float64Array.from([1, 2, 3, 4]);
  it("interpola entre los vecinos", () => {
    expect(percentil(datos, 0.25)).toBeCloseTo(1.75, 12);
    expect(percentil(datos, 0.5)).toBeCloseTo(2.5, 12);
    expect(percentil(datos, 0.95)).toBeCloseTo(3.85, 12);
  });
  it("en los extremos da el mínimo y el máximo; con un solo dato, ese dato", () => {
    expect(percentil(datos, 0)).toBe(1);
    expect(percentil(datos, 1)).toBe(4);
    expect(percentil(Float64Array.from([41.3]), 0.73)).toBe(41.3);
  });
  it("rechaza datos vacíos o q fuera de [0, 1]", () => {
    expect(() => percentil(new Float64Array(0), 0.5)).toThrow(RangeError);
    expect(() => percentil(datos, -0.1)).toThrow(RangeError);
    expect(() => percentil(datos, 1.1)).toThrow(RangeError);
    expect(() => percentil(datos, Number.NaN)).toThrow(RangeError);
  });
});

describe("media y desviación", () => {
  it("de una muestra", () => {
    expect(media([2, 4, 9])).toBeCloseTo(5, 12);
    expect(desviacion([2, 4, 9])).toBeCloseTo(Math.sqrt(13), 12); // muestral (n − 1)
    expect(media([])).toBeNaN();
    expect(desviacion([7])).toBeNaN();
  });
});
