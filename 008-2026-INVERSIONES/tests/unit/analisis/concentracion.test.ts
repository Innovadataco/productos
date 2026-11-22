// Concentración del portafolio en acciones: pesos iguales, una sola especie, empates, bordes y la propiedad del HHI con
// semilla (crearPrng). Puro.
import { describe, expect, it } from "vitest";
import { concentracionDe } from "@/analisis/concentracion";
import { crearPrng } from "@/proyecciones/prng";
import { D } from "./fixtures/portafolio.ficticio";

describe("concentración", () => {
  it("cuatro especies de igual valor: HHI 0,25 y cuatro especies efectivas", () => {
    // 37 × 1237,4 = 74 × 618,7 = 148 × 309,35 = 296 × 154,675 = 45.783,8 exactos.
    const valores = [D(37).mul("1237.4"), D(74).mul("618.7"), D(148).mul("309.35"), D(296).mul("154.675")];
    expect(valores.every((x) => x.eq("45783.8"))).toBe(true);
    const c = concentracionDe(["FICTICIA-C", "FICTICIA-A", "FICTICIA-D", "FICTICIA-B"].map((instrumentoId, j) => ({ instrumentoId, valor: valores[j]! })));
    expect(c).toEqual({
      especies: 4,
      primera: { instrumentoId: "FICTICIA-A", peso: 0.25 },
      tresPrimeras: { instrumentoIds: ["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"], peso: 0.75 },
      hhi: 0.25,
      especiesEfectivas: 4,
    });
  });

  it("una sola especie: todo el peso, HHI 1", () => {
    expect(concentracionDe([{ instrumentoId: "FICTICIA-A", valor: D("4613.27") }])).toEqual({
      especies: 1,
      primera: { instrumentoId: "FICTICIA-A", peso: 1 },
      tresPrimeras: { instrumentoIds: ["FICTICIA-A"], peso: 1 },
      hhi: 1,
      especiesEfectivas: 1,
    });
  });

  it("pesos 0,75 y 0,25: HHI 0,625 y 1,6 especies efectivas, de mayor a menor valor", () => {
    const c = concentracionDe([{ instrumentoId: "FICTICIA-B", valor: D("1237.41") }, { instrumentoId: "FICTICIA-A", valor: D("3712.23") }]);
    expect(c).toMatchObject({ primera: { instrumentoId: "FICTICIA-A", peso: 0.75 }, hhi: 0.625, especiesEfectivas: 1.6 });
  });

  it("sin valor o con valor cero no cuenta; sin ninguna con valor, null", () => {
    const c = concentracionDe([
      { instrumentoId: "FICTICIA-A", valor: D("4613.27") },
      { instrumentoId: "FICTICIA-B", valor: null },
      { instrumentoId: "FICTICIA-C", valor: D(0) },
    ]);
    expect(c?.especies).toBe(1);
    expect(concentracionDe([])).toBeNull();
    expect(concentracionDe([{ instrumentoId: "FICTICIA-B", valor: null }])).toBeNull();
  });

  it("un valor negativo viola el contrato del tablero", () => {
    expect(() => concentracionDe([{ instrumentoId: "FICTICIA-A", valor: D("-1.37") }])).toThrow(RangeError);
  });
});

describe("propiedad del HHI (80 semillas)", () => {
  it("queda en [1/n, 1] y las especies efectivas en [1, n], con el error del redondeo a 8 decimales", () => {
    for (let semilla = 1; semilla <= 80; semilla += 1) {
      const p = crearPrng(semilla);
      const n = 1 + p.enteroMenorQue(12);
      const especies = Array.from({ length: n }, (_, j) => ({
        instrumentoId: `FICTICIA-${String(j).padStart(2, "0")}`,
        valor: D(1 + p.enteroMenorQue(4999)).mul((100 + p.uniforme() * 9000).toFixed(2)),
      }));
      const c = concentracionDe(especies)!;
      expect(c.especies).toBe(n);
      expect(c.hhi, `semilla ${semilla}`).toBeGreaterThanOrEqual(1 / n - 1e-8);
      expect(c.hhi).toBeLessThanOrEqual(1);
      expect(c.especiesEfectivas).toBeGreaterThanOrEqual(1);
      expect(c.especiesEfectivas).toBeLessThanOrEqual(n + 1e-6);
      expect(c.primera.peso).toBeGreaterThanOrEqual(1 / n - 1e-8);
    }
  });
});
