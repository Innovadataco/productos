// La procedencia de lo que calculó el sistema en la conciliación (frente fecha-hora-datos): de qué cierre (o valor de
// unidad del fondo) salió cada «Valor sistema», cuándo lo trajo 008 y de qué fuente. Es la del dato con que se
// CALCULÓ: el vigente al instante de `calculadaEn` (traído antes y todavía no retirado), no el de hoy; entre los del
// mismo día, con el mismo orden que el cálculo (Yahoo primero, luego el traído más recientemente). Se lee en una
// transacción de solo lectura y solo de las especies y fondos cuyo valor se calculó. Datos inventados (2027).
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { aVistaCorte } from "@/app/conciliacion/serializar";
import { idsCalculados, leerProcedencias, procedenciasDeLaLectura, SIN_PROCEDENCIAS } from "@/app/conciliacion/procedencias";
import { cierresDelDia } from "@/conciliacion/esperado";
import type { ControlLeido, LecturaConciliacion } from "@/conciliacion/leer";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const CORTE = dia("2027-03-31");
const CALCULADA = new Date("2027-04-01T01:13:00Z");

interface FilaCierre { instrumentoId: string; fuente: string; traidoEn: Date; precio?: Prisma.Decimal }
interface FilaFondo { fondoId: string; fuente: string; traidoEn: Date }

function baseFalsa(cierres: FilaCierre[], fondos: FilaFondo[]) {
  const precioCierre = { findMany: vi.fn(async () => cierres) };
  const valorUnidadFondo = { findMany: vi.fn(async () => fondos) };
  const executeRaw = vi.fn(async () => 0);
  const tx = { precioCierre, valorUnidadFondo, $executeRaw: executeRaw };
  const transaction = vi.fn(async (leer: (t: typeof tx) => Promise<unknown>, opciones: unknown) => { void opciones; return leer(tx); });
  return { db: { $transaction: transaction } as never, precioCierre, valorUnidadFondo, executeRaw, transaction };
}

const VIGENTE_AL_CALCULO = { traidoEn: { lte: CALCULADA }, OR: [{ reemplazadoEn: null }, { reemplazadoEn: { gt: CALCULADA } }] };

describe("leerProcedencias", () => {
  it("lee los cierres del corte vigentes al instante del cálculo, solo de las especies pedidas, en solo lectura", async () => {
    const b = baseFalsa([], []);
    await leerProcedencias(b.db, { corte: CORTE, calculadaEn: CALCULADA, especies: ["a", "b"], fondos: ["f"] });
    expect(b.transaction).toHaveBeenCalledTimes(1);
    expect(String((b.executeRaw.mock.calls[0] as unknown[] | undefined)?.[0] ?? "")).toContain("SET TRANSACTION READ ONLY");
    expect(b.precioCierre.findMany).toHaveBeenCalledWith({
      where: { instrumentoId: { in: ["a", "b"] }, fecha: CORTE, ...VIGENTE_AL_CALCULO },
      select: { instrumentoId: true, fuente: true, traidoEn: true },
    });
    expect(b.valorUnidadFondo.findMany).toHaveBeenCalledWith({
      where: { fondoId: { in: ["f"] }, fechaValor: CORTE, ...VIGENTE_AL_CALCULO },
      select: { fondoId: true, fuente: true, traidoEn: true },
    });
  });

  it("de varios cierres del mismo día elige como el cálculo: Yahoo primero; sin Yahoo, el traído más recientemente", async () => {
    const t = (iso: string) => new Date(iso);
    const b = baseFalsa([
      { instrumentoId: "a", fuente: "otra-ficticia", traidoEn: t("2027-03-31T23:59:00Z") },
      { instrumentoId: "a", fuente: "yahoo", traidoEn: t("2027-03-31T22:04:00Z") },
      { instrumentoId: "b", fuente: "otra-ficticia", traidoEn: t("2027-03-31T21:00:00Z") },
      { instrumentoId: "b", fuente: "zeta-ficticia", traidoEn: t("2027-03-31T23:30:00Z") },
    ], [
      { fondoId: "f", fuente: "sfc:qhpu-8ixx", traidoEn: t("2027-03-31T14:00:00Z") },
      { fondoId: "f", fuente: "sfc:qhpu-8ixx", traidoEn: t("2027-03-31T18:00:00Z") },
    ]);
    const r = await leerProcedencias(b.db, { corte: CORTE, calculadaEn: CALCULADA, especies: ["a", "b"], fondos: ["f"] });
    expect(Object.fromEntries(r.cierres)).toEqual({
      a: { fuente: "yahoo", traidoEn: t("2027-03-31T22:04:00Z") },
      b: { fuente: "zeta-ficticia", traidoEn: t("2027-03-31T23:30:00Z") },
    });
    expect(Object.fromEntries(r.fondos)).toEqual({ f: { fuente: "sfc:qhpu-8ixx", traidoEn: t("2027-03-31T18:00:00Z") } });
  });

  it("elige el MISMO cierre que cierresDelDia (el del cálculo) con las mismas filas", async () => {
    const t = (iso: string) => new Date(iso);
    const filas: FilaCierre[] = [
      { instrumentoId: "a", fuente: "otra-ficticia", traidoEn: t("2027-03-31T23:59:00Z"), precio: D("317.41") },
      { instrumentoId: "a", fuente: "yahoo", traidoEn: t("2027-03-31T22:04:00Z"), precio: D("319.07") },
      { instrumentoId: "b", fuente: "beta-ficticia", traidoEn: t("2027-03-31T21:00:00Z"), precio: D("1211.09") },
      { instrumentoId: "b", fuente: "alfa-ficticia", traidoEn: t("2027-03-31T21:00:00Z"), precio: D("1213.31") },
    ];
    const precioDe = new Map(filas.map((f) => [`${f.instrumentoId}|${f.fuente}`, f.precio!.toString()]));
    const delCalculo = await cierresDelDia({ precioCierre: { findMany: async () => filas } } as never, CORTE, ["a", "b"]);
    const r = await leerProcedencias(baseFalsa(filas, []).db, { corte: CORTE, calculadaEn: CALCULADA, especies: ["a", "b"], fondos: [] });
    for (const id of ["a", "b"]) expect(precioDe.get(`${id}|${r.cierres.get(id)!.fuente}`), id).toBe(delCalculo.get(id));
  });

  it("sin especies ni fondos no abre ninguna transacción", async () => {
    const b = baseFalsa([], []);
    expect(await leerProcedencias(b.db, { corte: CORTE, calculadaEn: CALCULADA, especies: [], fondos: [] })).toBe(SIN_PROCEDENCIAS);
    expect(b.transaction).not.toHaveBeenCalled();
  });

  it("con especies y sin fondos no consulta los fondos (ni al revés)", async () => {
    const b = baseFalsa([], []);
    await leerProcedencias(b.db, { corte: CORTE, calculadaEn: CALCULADA, especies: ["a"], fondos: [] });
    expect(b.valorUnidadFondo.findMany).not.toHaveBeenCalled();
    const c = baseFalsa([], []);
    await leerProcedencias(c.db, { corte: CORTE, calculadaEn: CALCULADA, especies: [], fondos: ["f"] });
    expect(c.precioCierre.findMany).not.toHaveBeenCalled();
  });
});

const accion = (nemo: string) => ({ nemotecnico: nemo, nombre: `Acción ${nemo}`, tipo: "ACCION" as const });
function control(c: Partial<ControlLeido> & Pick<ControlLeido, "tipo">): ControlLeido {
  return { instrumentoId: null, esperado: null, real: null, diferencia: null, tolerancia: null, resultado: "CUADRA", codigoMotivo: null, detalle: null, instrumento: null, ...c };
}
const CONTROLES: ControlLeido[] = [
  control({ tipo: "CANTIDAD", instrumentoId: "a", esperado: D("13"), real: D("13"), instrumento: accion("FICTA") }),
  control({ tipo: "VALOR", instrumentoId: "a", esperado: D("4126.33"), real: D("4126.33"), instrumento: accion("FICTA") }),
  control({ tipo: "VALOR", instrumentoId: "b", esperado: D("8477.63"), real: D("8477.63"), instrumento: accion("FICTB") }),
  control({ tipo: "VALOR", instrumentoId: "c", real: D("2515.85"), resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", instrumento: accion("FICTC") }),
  control({ tipo: "CANTIDAD", instrumentoId: "i", esperado: D("-3"), real: D("0"), resultado: "NO_CUADRA", codigoMotivo: "no_certificada", instrumento: accion("FICTI") }),
  control({ tipo: "VALOR", esperado: D("12603.96"), real: D("12603.96"), detalle: { alcance: "total_acciones" } }),
  control({ tipo: "FONDO", instrumentoId: "f", esperado: D("6137.29"), real: D("6137.29"), instrumento: { nemotecnico: null, nombre: "Fondo ficticio uno", tipo: "FIC" } }),
  control({ tipo: "FONDO", instrumentoId: "g", real: D("911"), resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades", instrumento: { nemotecnico: null, nombre: "Fondo ficticio dos", tipo: "FIC" } }),
  control({ tipo: "EFECTIVO", esperado: D("250"), real: D("250") }),
];
const LECTURA: LecturaConciliacion = {
  fechaCorte: CORTE,
  conciliacion: { id: "k7", fechaCorte: CORTE, calculadaEn: CALCULADA, versionCalculo: "conciliacion-v3", resultado: "NO_CUADRA", controles: CONTROLES },
  frescura: "AL_DIA",
  porLiquidar: [],
};

describe("idsCalculados", () => {
  it("solo las especies y los fondos cuyo valor se calculó con un dato (no los sin precio, ni los solo de cantidad)", () => {
    expect(idsCalculados(LECTURA.conciliacion!)).toEqual({ especies: ["a", "b"], fondos: ["f"] });
  });
});

describe("procedenciasDeLaLectura", () => {
  it("lee las del corte al instante del cálculo, con las especies y los fondos calculados", async () => {
    const b = baseFalsa([], []);
    await procedenciasDeLaLectura(b.db, LECTURA);
    expect(b.precioCierre.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { instrumentoId: { in: ["a", "b"] }, fecha: CORTE, ...VIGENTE_AL_CALCULO } }));
    expect(b.valorUnidadFondo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { fondoId: { in: ["f"] }, fechaValor: CORTE, ...VIGENTE_AL_CALCULO } }));
  });

  it("sin conciliación guardada no lee nada", async () => {
    const b = baseFalsa([], []);
    expect(await procedenciasDeLaLectura(b.db, { ...LECTURA, conciliacion: null, frescura: null })).toBe(SIN_PROCEDENCIAS);
    expect(b.transaction).not.toHaveBeenCalled();
  });
});

describe("aVistaCorte · procedencias", () => {
  const procedencias = {
    cierres: new Map([
      ["a", { fuente: "yahoo", traidoEn: new Date("2027-03-31T23:04:00Z") }],
      ["b", { fuente: "yahoo", traidoEn: new Date("2027-04-01T00:41:00Z") }],
    ]),
    fondos: new Map([["f", { fuente: "sfc:qhpu-8ixx", traidoEn: new Date("2027-03-31T18:00:00Z") }]]),
  };

  it("por especie y por fondo: el día del corte, cuándo se trajo en hora de Colombia y la fuente", () => {
    const p = aVistaCorte(LECTURA, procedencias).conciliacion!.procedencias;
    expect(p.especies).toEqual({
      a: { dia: "2027-03-31", traidoEn: "2027-03-31 18:04", fuente: "yahoo" },
      b: { dia: "2027-03-31", traidoEn: "2027-03-31 19:41", fuente: "yahoo" },
    });
    expect(p.fondos).toEqual({ f: { dia: "2027-03-31", traidoEn: "2027-03-31 13:00", fuente: "sfc:qhpu-8ixx" } });
  });

  it("el total de acciones: el cierre más viejo de los que lo componen (todos del corte, sin aviso)", () => {
    expect(aVistaCorte(LECTURA, procedencias).conciliacion!.procedencias.total).toEqual({
      masVieja: { dia: "2027-03-31", traidoEn: "2027-03-31 18:04", fuente: "yahoo" }, masReciente: "2027-03-31", mezcladas: false, fuentes: ["yahoo"],
    });
  });

  it("sin procedencias leídas (o sin total calculado) no se inventa ninguna", () => {
    expect(aVistaCorte(LECTURA).conciliacion!.procedencias).toEqual({ especies: {}, fondos: {}, total: null });
    expect(aVistaCorte(LECTURA, SIN_PROCEDENCIAS).conciliacion!.procedencias).toEqual({ especies: {}, fondos: {}, total: null });
    const sinTotal = { ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles: CONTROLES.map((c) => (c.tipo === "VALOR" && c.instrumentoId === null ? { ...c, esperado: null } : c)) } };
    expect(aVistaCorte(sinTotal, procedencias).conciliacion!.procedencias.total).toBeNull();
  });

  it("una procedencia de una especie que no se calculó no entra", () => {
    const extra = { ...procedencias, cierres: new Map([...procedencias.cierres, ["c", { fuente: "yahoo", traidoEn: new Date("2027-03-31T23:04:00Z") }]]) };
    expect(Object.keys(aVistaCorte(LECTURA, extra).conciliacion!.procedencias.especies)).toEqual(["a", "b"]);
  });
});
