import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluarCaida, type PosicionCaida } from "@/alertas/evaluar/portafolio";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const D = (v: string) => new Prisma.Decimal(v);
const pos = (id: string, tenencia: bigint, precio: string | null, anterior: string | null): PosicionCaida => ({
  instrumentoId: id, tenencia, precio: precio === null ? null : D(precio), cierreAnterior: anterior === null ? null : D(anterior),
});
const evaluar = (posiciones: PosicionCaida[], umbrales = UMBRALES_OMISION) => evaluarCaida({ dia: "2027-03-01", base: "CIERRE", posiciones }, umbrales);

describe("evaluarCaida", () => {
  it("salta con la caída exacta del umbral (2 %), inclusive", () => {
    expect(evaluar([pos("FICTICIA-A", 10n, "98", "100")])).toMatchObject({ tipo: "CAIDA_PORTAFOLIO", sentido: "BAJO", instrumentoId: null, datos: { variacionPct: D("-2") } });
  });
  it("justo por debajo del umbral no salta; una alza tampoco", () => {
    expect(evaluar([pos("FICTICIA-A", 10n, "98.01", "100")])).toBeNull();
    expect(evaluar([pos("FICTICIA-A", 10n, "120", "100")])).toBeNull();
  });
  it("pondera por la tenencia: una especie que sube compensa a otra que cae", () => {
    // A: 10 × 100 = 1000 → 10 × 90 = 900; B: 100 × 10 = 1000 → 100 × 11 = 1100. Total 2000 → 2000.
    expect(evaluar([pos("FICTICIA-A", 10n, "90", "100"), pos("FICTICIA-B", 100n, "11", "10")])).toBeNull();
    // Con B quieta, la caída es 100 de 2000 = 5 %.
    expect(evaluar([pos("FICTICIA-A", 10n, "90", "100"), pos("FICTICIA-B", 100n, "10", "10")])).toMatchObject({ datos: { variacionPct: D("-5") } });
  });
  it("falla cerrada: una especie con tenencia y sin precio o sin cierre anterior anula la alerta", () => {
    expect(evaluar([pos("FICTICIA-A", 10n, "50", "100"), pos("FICTICIA-B", 5n, null, "10")])).toBeNull();
    expect(evaluar([pos("FICTICIA-A", 10n, "50", "100"), pos("FICTICIA-B", 5n, "10", null)])).toBeNull();
  });
  it("las especies sin tenencia no cuentan, ni su falta de precio", () => {
    expect(evaluar([pos("FICTICIA-A", 10n, "50", "100"), pos("FICTICIA-B", 0n, null, null), pos("FICTICIA-C", -3n, null, null)])).not.toBeNull();
  });
  it("sin posiciones, o con valor anterior cero, no salta", () => {
    expect(evaluar([])).toBeNull();
    expect(evaluar([pos("FICTICIA-A", 0n, "1", "1")])).toBeNull();
    expect(evaluar([pos("FICTICIA-A", 10n, "1", "0")])).toBeNull();
  });
  it("las cuentas son exactas con tenencias enormes (BigInt × Decimal)", () => {
    const t = 12345678901234567890123n;
    // Con precisión de 20 dígitos el redondeo escondería la diferencia de 1 centavo por acción en el borde.
    expect(evaluar([pos("FICTICIA-A", t, "98.0000", "100.0000")])).not.toBeNull();
    expect(evaluar([pos("FICTICIA-A", t, "98.0001", "100.0000")])).toBeNull();
  });
  it("respeta el umbral y el interruptor", () => {
    expect(evaluar([pos("FICTICIA-A", 1n, "99", "100")], { ...UMBRALES_OMISION, alertaCaidaPct: 1 })).not.toBeNull();
    expect(evaluar([pos("FICTICIA-A", 1n, "50", "100")], { ...UMBRALES_OMISION, alertaCaidaActiva: false })).toBeNull();
  });
  it("la clave no incluye especie ni regla", () => {
    expect(evaluar([pos("FICTICIA-A", 1n, "50", "100")])?.clave).toBe("2027-03-01|CAIDA_PORTAFOLIO|-|-|BAJO");
  });
});
