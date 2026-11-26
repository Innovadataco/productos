import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluarAlertas, type EntradaEvaluacion, type EspecieEvaluada } from "@/alertas/evaluar";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const D = (v: string) => new Prisma.Decimal(v);
const f = (s: string) => new Date(`${s}T00:00:00Z`);
const cot = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-05:00`);
const COMPRA = [{ fecha: f("2027-01-10"), cantidad: 10n }];

const especie = (id: string, o: Partial<EspecieEvaluada> = {}): EspecieEvaluada => ({
  instrumentoId: id, reglas: [], movimientos: COMPRA, intradia: null, cierreHoy: null, cierreAnterior: null, ...o,
});
const entrada = (especies: EspecieEvaluada[], o: Partial<EntradaEvaluacion> = {}): EntradaEvaluacion => ({
  ahora: cot("2027-03-01", "17:30"), umbrales: UMBRALES_OMISION, intradiaActivo: true, noHabiles: new Set(), especies, decretos: [], ...o,
});
const regla = { id: "r1", condicion: "CIERRE_BAJO", nivel: D("100") } as const;

describe("evaluarAlertas", () => {
  it("sin nada que evaluar no hay alertas", () => {
    expect(evaluarAlertas(entrada([]))).toEqual([]);
  });

  it("junta los tipos, con el día de Colombia en la clave y en orden estable", () => {
    const e = entrada([
      especie("FICTICIA-B", { reglas: [regla], cierreHoy: D("90"), cierreAnterior: D("100") }),
      especie("FICTICIA-A", { reglas: [regla], cierreHoy: D("90"), cierreAnterior: D("100") }),
    ]);
    const r = evaluarAlertas(e);
    expect(r.map((a) => a.clave)).toEqual([...r.map((a) => a.clave)].sort());
    expect(r.map((a) => a.tipo).sort()).toEqual(["CAIDA_PORTAFOLIO", "MOVIMIENTO_DIA", "MOVIMIENTO_DIA", "NIVEL_CRUZADO", "NIVEL_CRUZADO"]);
    expect(r.every((a) => a.dia === "2027-03-01")).toBe(true);
    expect(evaluarAlertas({ ...e, especies: [...e.especies].reverse() })).toEqual(r);
  });

  it("el día de Colombia sale de `ahora`: a las 21:00 COT sigue siendo el mismo día", () => {
    const r = evaluarAlertas(entrada([especie("FICTICIA-A", { reglas: [regla], cierreHoy: D("90") })], { ahora: cot("2027-03-01", "23:30") }));
    expect(r[0]!.dia).toBe("2027-03-01");
  });

  it("un cruce en el intradía y en el cierre del mismo día cuenta una sola vez, con la base del cierre", () => {
    const e = especie("FICTICIA-A", { reglas: [regla], cierreHoy: D("90"), intradia: { instante: cot("2027-03-01", "15:00"), precio: D("91"), conRetraso: true } });
    const r = evaluarAlertas(entrada([e])).filter((a) => a.tipo === "NIVEL_CRUZADO");
    expect(r).toHaveLength(1);
    expect(r[0]!.base).toBe("CIERRE");
  });

  it("un cruce solo en el intradía salta con base intradía; el intradía apagado lo ignora", () => {
    const e = especie("FICTICIA-A", { reglas: [regla], intradia: { instante: cot("2027-03-01", "11:00"), precio: D("91"), conRetraso: false } });
    const ahora = cot("2027-03-01", "11:10");
    expect(evaluarAlertas(entrada([e], { ahora })).filter((a) => a.tipo === "NIVEL_CRUZADO")).toMatchObject([{ base: "INTRADIA" }]);
    expect(evaluarAlertas(entrada([e], { ahora, intradiaActivo: false })).filter((a) => a.tipo === "NIVEL_CRUZADO")).toEqual([]);
  });

  it("una barra de otro día no cuenta como precio de hoy", () => {
    const e = especie("FICTICIA-A", { reglas: [regla], intradia: { instante: cot("2027-02-26", "15:00"), precio: D("91"), conRetraso: false } });
    expect(evaluarAlertas(entrada([e], { ahora: cot("2027-03-01", "10:00") })).filter((a) => a.tipo === "NIVEL_CRUZADO")).toEqual([]);
  });

  it("dato viejo solo para las especies que se tienen", () => {
    const ahora = cot("2027-03-01", "14:00");
    const r = evaluarAlertas(entrada([especie("FICTICIA-A"), especie("FICTICIA-B", { movimientos: [] })], { ahora }));
    expect(r.filter((a) => a.tipo === "DATO_VIEJO").map((a) => a.instrumentoId)).toEqual(["FICTICIA-A"]);
  });

  it("FECHA_EX: una alerta por decreto, y el día ex lo marca el movimiento", () => {
    const decretos = [
      { id: "d1", instrumentoId: "FICTICIA-A", fechaEx: f("2027-03-01"), fechaPago: f("2027-04-01"), vigente: true, anulada: false },
      { id: "d2", instrumentoId: "FICTICIA-A", fechaEx: f("2027-03-03"), fechaPago: f("2027-04-01"), vigente: true, anulada: false },
      { id: "d3", instrumentoId: "FICTICIA-A", fechaEx: f("2027-03-03"), fechaPago: f("2027-04-01"), vigente: true, anulada: true },
    ];
    const r = evaluarAlertas(entrada([especie("FICTICIA-A", { cierreHoy: D("90"), cierreAnterior: D("100") })], { decretos }));
    expect(r.filter((a) => a.tipo === "FECHA_EX").map((a) => a.reglaId)).toEqual(["d1", "d2"]);
    expect(r.find((a) => a.tipo === "MOVIMIENTO_DIA")!.datos.esFechaEx).toBe(true);
  });

  it("la caída del portafolio falla cerrada si una especie que se tiene no tiene precio", () => {
    const e = [especie("FICTICIA-A", { cierreHoy: D("50"), cierreAnterior: D("100") }), especie("FICTICIA-B")];
    expect(evaluarAlertas(entrada(e)).some((a) => a.tipo === "CAIDA_PORTAFOLIO")).toBe(false);
  });

  it("la caída puede salir del intradía cuando todavía no hay cierres", () => {
    const e = [especie("FICTICIA-A", { intradia: { instante: cot("2027-03-01", "11:00"), precio: D("90"), conRetraso: false }, cierreAnterior: D("100") })];
    expect(evaluarAlertas(entrada(e, { ahora: cot("2027-03-01", "11:10") })).filter((a) => a.tipo === "CAIDA_PORTAFOLIO")).toMatchObject([{ base: "INTRADIA" }]);
  });

  it("los interruptores apagados dejan pasar solo lo demás, y no hay claves repetidas", () => {
    const e = entrada([especie("FICTICIA-A", { reglas: [regla, { ...regla, id: "r2" }], cierreHoy: D("90"), cierreAnterior: D("100") })], {
      umbrales: { ...UMBRALES_OMISION, alertaMovimientoActiva: false, alertaCaidaActiva: false },
    });
    const r = evaluarAlertas(e);
    expect(r.map((a) => a.tipo)).toEqual(["NIVEL_CRUZADO", "NIVEL_CRUZADO"]);
    expect(new Set(r.map((a) => a.clave)).size).toBe(2);
  });

  it("es determinista y no muta la entrada", () => {
    const e = entrada([especie("FICTICIA-A", { reglas: [regla], cierreHoy: D("90"), cierreAnterior: D("100") })]);
    const foto = () => JSON.stringify(e, (_k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Set ? [...v] : v));
    const antes = foto();
    const a = evaluarAlertas(Object.freeze(e));
    expect(evaluarAlertas(e)).toEqual(a);
    expect(foto()).toBe(antes);
  });

  it("una barra del futuro no sirve de precio de hoy", () => {
    const futura = { instante: cot("2027-03-01", "15:30"), precio: D("91"), conRetraso: false };
    const r = evaluarAlertas(entrada([especie("FICTICIA-A", { reglas: [regla], intradia: futura })], { ahora: cot("2027-03-01", "11:00") }));
    expect(r.filter((a) => a.tipo === "NIVEL_CRUZADO")).toEqual([]);
  });

  it("valida los umbrales otra vez: NaN, negativos, infinitos o fuera de rango dan un error claro", () => {
    const e = entrada([]);
    for (const malo of [Number.NaN, -1, Infinity, 0]) {
      expect(() => evaluarAlertas({ ...e, umbrales: { ...UMBRALES_OMISION, alertaCercaPct: malo } })).toThrow(RangeError);
    }
    expect(() => evaluarAlertas({ ...e, umbrales: { ...UMBRALES_OMISION, alertaCaidaActiva: "si" as unknown as boolean } })).toThrow(/alertaCaidaActiva/);
  });

  it("un fechaEx inválido descarta solo ese decreto", () => {
    const malo = { id: "dx", instrumentoId: "FICTICIA-A", fechaEx: new Date("no es una fecha"), fechaPago: f("2027-04-01"), vigente: true, anulada: false };
    const bueno = { id: "d1", instrumentoId: "FICTICIA-A", fechaEx: f("2027-03-01"), fechaPago: f("2027-04-01"), vigente: true, anulada: false };
    const r = evaluarAlertas(entrada([especie("FICTICIA-A", { cierreHoy: D("100"), cierreAnterior: D("100") })], { decretos: [malo, bueno] }));
    expect(r.filter((a) => a.tipo === "FECHA_EX").map((a) => a.reglaId)).toEqual(["d1"]);
  });
});
