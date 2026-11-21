// Serialización del tablero (src/app/tablero/serializar.ts): lo que cruza del servidor al cliente es texto.
import { describe, expect, it } from "vitest";
import { cop, n } from "@/app/tablero/formato";
import { aVista } from "@/app/tablero/serializar";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

const viva = especie({
  nemotecnico: "FICT1", cantidad: 12_345_678_901_234_567_890n, costoVivo: D("0.1").add("0.2"),
  cierre: { precio: D("1234.5"), fecha: dia("2024-11-22"), verificado: true },
  serie: [punto("2024-11-21", 1200), punto("2024-11-22", 1234.5)],
});

describe("aVista · última carga en hora de Colombia (UTC−5)", () => {
  it.each([
    ["2026-11-21T04:59:59.999Z", "2026-11-20"], // 23:59:59 del 20 en Bogotá
    ["2026-11-21T05:00:00.000Z", "2026-11-21"], // medianoche del 21 en Bogotá
    ["2026-01-01T04:59:59.000Z", "2025-12-31"], // cambio de año
    ["2024-03-01T04:30:00.000Z", "2024-02-29"], // año bisiesto
  ])("%s → %s", (instante, esperado) => {
    expect(aVista(resumenDe([], { ultimaCarga: new Date(instante) })).ultimaCarga).toBe(esperado);
  });

  it("sin carga, null", () => {
    expect(aVista(resumenDe([], { ultimaCarga: null })).ultimaCarga).toBeNull();
  });
});

describe("aVista · cifras y fechas de las filas", () => {
  const f = aVista(resumenDe([viva])).filas[0]!;

  it("las fechas DATE conservan su día (medianoche UTC, sin desfase)", () => {
    expect(f.cierre?.fecha).toBe("2024-11-22");
    expect(f.serie.map((p) => p.fecha)).toEqual(["2024-11-21", "2024-11-22"]);
  });

  it("los Decimal y los bigint cruzan como texto exacto", () => {
    expect([f.cantidad, f.costo, f.cierre?.precio]).toEqual(["12345678901234567890", "0.3", "1234.5"]);
    expect(f.serie.map((p) => p.precio)).toEqual(["1200", "1234.5"]);
  });

  it("rentabilidad y peso con dos decimales", () => {
    expect(f.pesoPct).toBe("100.00");
    expect(f.rentabilidadPct).toMatch(/^\d+\.\d{2}$/);
  });

  it("una ganancia que da cero (o -0) se pinta «$ 0», sin signo", () => {
    const cero = aVista(resumenDe([especie({ nemotecnico: "FICT2", cantidad: 10n, costoVivo: D(100), cierre: { precio: D(10), fecha: dia("2024-11-22"), verificado: false } })]));
    expect(cop(n(cero.sinVender), true)).toBe("$ 0");
    expect(cop(-n(cero.comisiones), true)).toBe("$ 0"); // −0 de negar una comisión 0
  });
});

describe("aVista · fechas de los cierres", () => {
  const vieja = especie({ nemotecnico: "FICT3", cantidad: 1n, costoVivo: D(1), cierre: { precio: D(2), fecha: dia("2024-11-01"), verificado: false } });
  const v = aVista(resumenDe([viva, vieja]));

  it("pasa la referencia, el cierre más viejo y cuántas van atrasadas (no el máximo global)", () => {
    expect([v.fechaReferencia, v.cierreMasViejo, v.especiesAtrasadas]).toEqual(["2024-11-22", "2024-11-01", 1]);
    expect(v).not.toHaveProperty("ultimoCierre");
  });

  it("el conteo de atrasadas y la marca de cada fila son la misma fuente", () => {
    expect(v.especiesAtrasadas).toBe(v.filas.filter((f) => f.cierre?.atrasado).length);
  });

  it("cada fila dice si su cierre va atrasado", () => {
    expect(v.filas.map((f) => [f.nemo, f.cierre?.atrasado])).toEqual([["FICT1", false], ["FICT3", true]]);
  });
});
