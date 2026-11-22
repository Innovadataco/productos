// Próximos ex-dividendos (fase C, C5b: src/datos-oficiales/decretos/proximos.ts). Puro: los decretos vigentes, no
// anulados y con fecha ex mayor o igual a hoy, en orden, con la tenencia de la especie y el bruto ESTIMADO. Datos
// inventados: especies FICT*, números raros, fechas de 2027.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { proximos, type DecretoVigente } from "@/datos-oficiales/decretos/proximos";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const D = (v: string) => new Prisma.Decimal(v);
const HOY = dia("2027-06-09");

const vigente = (c: Partial<DecretoVigente> = {}): DecretoVigente => ({
  id: "dec-1", instrumentoId: "ins-a", nemotecnico: "FICTA", tipo: "ORDINARIO", cuota: 1, valorPorAccion: D("2.613719"),
  fechaAnuncio: dia("2027-03-17"), fechaEx: dia("2027-06-16"), fechaPago: dia("2027-06-23"), referenciaOficial: "sfc:FICT-1237", version: 1,
  vigente: true, anulada: false, ...c,
});
const MOVS = new Map([
  ["ins-a", [{ fecha: dia("2027-02-03"), cantidad: 1237n }, { fecha: dia("2027-06-08"), cantidad: 311n }, { fecha: dia("2027-06-09"), cantidad: 97n }]],
  ["ins-b", [{ fecha: dia("2027-02-03"), cantidad: 113n }, { fecha: dia("2027-04-07"), cantidad: -131n }]],
]);

describe("decretos · próximos ex-dividendos", () => {
  it("solo los vigentes y no anulados con ex ≥ hoy: la ex de hoy entra, la de ayer no", () => {
    const r = proximos([
      vigente({ id: "ayer", fechaEx: dia("2027-06-08"), fechaPago: dia("2027-06-15") }),
      vigente({ id: "hoy", cuota: 2, fechaEx: HOY }),
      vigente({ id: "retirada", cuota: 3, vigente: false }),
      vigente({ id: "anulada", cuota: 4, anulada: true }),
      vigente({ id: "luego", cuota: 5 }),
    ], MOVS, HOY);
    expect(r.map((p) => p.id)).toEqual(["hoy", "luego"]);
    expect(r.every((p) => !("vigente" in p) && !("anulada" in p))).toBe(true);
  });

  it("orden: fecha ex, especie, cuota, tipo e id", () => {
    const r = proximos([
      vigente({ id: "z", instrumentoId: "ins-b", nemotecnico: "FICTB", fechaEx: dia("2027-06-16") }),
      vigente({ id: "c", tipo: "EXTRAORDINARIO", fechaEx: dia("2027-06-16") }),
      vigente({ id: "b", fechaEx: dia("2027-06-16") }),
      vigente({ id: "a", cuota: 2, fechaEx: dia("2027-06-16") }),
      vigente({ id: "primero", fechaEx: dia("2027-06-10") }),
    ], MOVS, HOY);
    expect(r.map((p) => p.id)).toEqual(["primero", "b", "c", "a", "z"]);
  });

  it("tenencia de hoy (o, si la ex es hoy, la del cierre de ayer) y bruto estimado = valor × tenencia, exacto", () => {
    const [hoy, luego] = proximos([vigente({ id: "hoy", fechaEx: HOY }), vigente({ id: "luego", cuota: 2 })], MOVS, HOY);
    expect(hoy).toMatchObject({ id: "hoy", tenencia: 1548n });
    expect(hoy!.brutoEstimado!.toFixed(6)).toBe("4046.037012");
    expect(luego).toMatchObject({ id: "luego", tenencia: 1645n });
    expect(luego!.brutoEstimado!.toFixed(6)).toBe("4299.567755");
  });

  it("sin tenencia el bruto estimado es 0; con tenencia negativa (datos incompletos) no se estima: null", () => {
    const r = proximos([vigente({ id: "sin", instrumentoId: "ins-c" }), vigente({ id: "neg", instrumentoId: "ins-b", nemotecnico: "FICTB" })], MOVS, HOY);
    expect(r.map((p) => [p.id, p.tenencia, p.brutoEstimado?.toFixed(6) ?? null])).toEqual([["sin", 0n, "0.000000"], ["neg", -18n, null]]);
  });

  it("lista vacía: nada", () => {
    expect(proximos([], MOVS, HOY)).toEqual([]);
  });
});
