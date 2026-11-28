import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluarMovimiento, type EntradaMovimiento } from "@/alertas/evaluar/mercado";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const D = (v: string) => new Prisma.Decimal(v);
const entrada = (precio: string | null, anterior: string | null, o: Partial<EntradaMovimiento> = {}): EntradaMovimiento => ({
  dia: "2027-03-01", instrumentoId: "FICTICIA-A", diaEsFechaEx: false,
  precio: precio === null ? null : { base: "CIERRE", precio: D(precio) }, cierreAnterior: anterior === null ? null : D(anterior), ...o,
});

describe("evaluarMovimiento", () => {
  it("el límite de 3 % es inclusivo, hacia arriba y hacia abajo", () => {
    expect(evaluarMovimiento(entrada("103", "100"), UMBRALES_OMISION)).toMatchObject({ tipo: "MOVIMIENTO_DIA", sentido: "SOBRE" });
    expect(evaluarMovimiento(entrada("97", "100"), UMBRALES_OMISION)).toMatchObject({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO" });
  });
  it("justo por debajo del límite no salta", () => {
    expect(evaluarMovimiento(entrada("102.99", "100"), UMBRALES_OMISION)).toBeNull();
    expect(evaluarMovimiento(entrada("97.01", "100"), UMBRALES_OMISION)).toBeNull();
  });
  it("la comparación es exacta, sin redondeo: 2,9999 % no salta aunque se muestre 3,00", () => {
    expect(evaluarMovimiento(entrada("102.9999", "100"), UMBRALES_OMISION)).toBeNull();
  });
  it("sin cierre anterior, sin precio o con cierre anterior no positivo no salta", () => {
    expect(evaluarMovimiento(entrada("200", null), UMBRALES_OMISION)).toBeNull();
    expect(evaluarMovimiento(entrada(null, "100"), UMBRALES_OMISION)).toBeNull();
    expect(evaluarMovimiento(entrada("200", "0"), UMBRALES_OMISION)).toBeNull();
    expect(evaluarMovimiento(entrada("0", "100"), UMBRALES_OMISION)).toBeNull();
  });
  it("respeta el umbral y el interruptor", () => {
    expect(evaluarMovimiento(entrada("101", "100"), { ...UMBRALES_OMISION, alertaMovimientoPct: 1 })).not.toBeNull();
    expect(evaluarMovimiento(entrada("110", "100"), { ...UMBRALES_OMISION, alertaMovimientoActiva: false })).toBeNull();
  });
  it("lleva la variación con signo y si el día es fecha ex; el día ex no se suprime", () => {
    const a = evaluarMovimiento(entrada("96", "100", { diaEsFechaEx: true }), UMBRALES_OMISION);
    expect(a).toMatchObject({ datos: { variacionPct: D("-4"), esFechaEx: true, precio: D("96") } });
  });
  it("la clave no depende de la base", () => {
    const a = evaluarMovimiento(entrada("110", "100"), UMBRALES_OMISION);
    const b = evaluarMovimiento({ ...entrada("110", "100"), precio: { base: "INTRADIA", precio: D("110") } }, UMBRALES_OMISION);
    expect(a?.clave).toBe(b?.clave);
    expect(a?.clave).toBe("2027-03-01|MOVIMIENTO_DIA|FICTICIA-A|-|SOBRE");
  });
});
