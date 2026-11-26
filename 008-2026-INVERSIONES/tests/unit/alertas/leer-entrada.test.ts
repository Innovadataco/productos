// leerEntrada (src/alertas/leer-entrada.ts) con la base simulada: sin versiones de umbrales rigen las omisiones; con una, sus
// valores; el cierre anterior es el del día hábil anterior (un lunes, el viernes; con un festivo en medio, el jueves); una especie
// sin cierre de ese día no tiene cierre anterior (falla cerrada); la barra intradía solo se lee con el interruptor encendido y la
// tenencia suma las compras y los lotes de escisión y resta las ventas. La prueba con la base y el rol real está en
// tests/integracion/alertas-leer.test.ts.
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { diaHabilAnterior, leerEntrada, umbralesDeFila, type LectorAlertas } from "@/alertas/leer-entrada";
import { UMBRALES_OMISION } from "@/alertas/umbrales";
import { tenenciaEn } from "@/plan/tenencia";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ESPECIE = { id: "e-1", nemotecnico: "FICTICIA-A" };

interface Datos {
  umbral?: Record<string, unknown> | null;
  festivos?: string[];
  cierres?: Array<{ fecha: string; precio: string; fuente?: string; traidoEn?: string }>;
  barra?: { instante: Date; precio: Prisma.Decimal; fuente: string; conRetraso: boolean; traidoEn: Date } | null;
}

/** El texto de una consulta cruda (Prisma.sql o plantilla). */
const textoSql = (t: unknown): string => (Array.isArray(t) ? t.join("?") : (t as { strings: readonly string[] }).strings.join("?"));

const MOVIMIENTOS = [
  { instrumentoId: "e-1", fecha: dia("2026-02-09"), cantidad: 100n },
  { instrumentoId: "e-1", fecha: dia("2026-03-09"), cantidad: -30n },
  { instrumentoId: "e-1", fecha: dia("2026-04-01"), cantidad: 5n },
];

/** La base simulada: la tenencia y la última barra van por SQL crudo (una consulta cada una, para todas las especies). */
function lector(d: Datos = {}) {
  const crudo = vi.fn(async (consulta: unknown) => {
    const sql = textoSql(consulta);
    if (sql.includes("UNION ALL")) return MOVIMIENTOS;
    if (sql.includes('FROM "precio_intradia"')) return d.barra ? [{ instrumentoId: "e-1", ...d.barra }] : [];
    return [];
  });
  const db = {
    $queryRaw: crudo,
    umbralVersion: { findFirst: vi.fn(async () => d.umbral ?? null) },
    calendarioBvc: { findMany: vi.fn(async () => (d.festivos ?? []).map((f) => ({ dia: dia(f) }))) },
    planVersion: { findFirst: vi.fn(async () => ({ id: "p-1" })) },
    reglaPlan: { findMany: vi.fn(async () => [{ id: "r-1", instrumentoId: "e-1", condicion: "CIERRE_BAJO", nivel: D("1000") }]) },
    instrumento: { findMany: vi.fn(async () => [ESPECIE]) },
    dividendoDecretado: { findMany: vi.fn(async () => []) },
    precioCierre: {
      findMany: vi.fn(async () => (d.cierres ?? []).map((c) => ({ instrumentoId: "e-1", fecha: dia(c.fecha), precio: D(c.precio), fuente: c.fuente ?? "yahoo", traidoEn: new Date(c.traidoEn ?? `${c.fecha}T23:00:00.000Z`) }))),
    },
  };
  return db as unknown as LectorAlertas & typeof db;
}

describe("diaHabilAnterior", () => {
  it("un martes, el lunes; un lunes, el viernes; con un festivo el viernes, el jueves", () => {
    expect(diaHabilAnterior(dia("2026-11-24"), new Set())).toEqual(dia("2026-11-23"));
    expect(diaHabilAnterior(dia("2026-11-23"), new Set())).toEqual(dia("2026-11-20"));
    expect(diaHabilAnterior(dia("2026-11-23"), new Set(["2026-11-20"]))).toEqual(dia("2026-11-19"));
  });

  it("sin ningún día hábil en 14 días (un calendario de puros festivos), null", () => {
    const todos = new Set(Array.from({ length: 14 }, (_, i) => new Date(dia("2026-11-23").getTime() - (i + 1) * 86_400_000).toISOString().slice(0, 10)));
    expect(diaHabilAnterior(dia("2026-11-23"), todos)).toBeNull();
  });
});

describe("leerEntrada", () => {
  const AHORA = new Date("2026-11-25T23:30:00.000Z");

  it("sin versiones de umbrales rigen las omisiones (versión nula)", async () => {
    const r = await leerEntrada(lector(), AHORA, false);
    expect(r.umbralVersionId).toBeNull();
    expect(r.entrada.umbrales).toEqual(UMBRALES_OMISION);
  });

  it("con una versión, sus valores y su id (los decimales pasan a número)", async () => {
    const fila = { id: "u-7", alertaCercaPct: D("4.5"), alertaCercaActiva: false, alertaNivelCruzadoActiva: true, alertaMovimientoPct: D("6"), alertaMovimientoActiva: true, alertaCaidaPct: D("2.25"), alertaCaidaActiva: true, alertaDatoViejoMin: 60, alertaDatoViejoActiva: true, alertaExDiasHabiles: 5, alertaExActiva: false };
    const r = await leerEntrada(lector({ umbral: fila }), AHORA, false);
    expect(r.umbralVersionId).toBe("u-7");
    expect(r.entrada.umbrales).toEqual(umbralesDeFila(fila as never));
    expect(r.entrada.umbrales).toMatchObject({ alertaCercaPct: 4.5, alertaCercaActiva: false, alertaCaidaPct: 2.25, alertaDatoViejoMin: 60, alertaExDiasHabiles: 5, alertaExActiva: false });
  });

  it("el cierre anterior es el del día hábil anterior: sin ese día no hay cierre anterior aunque exista uno más viejo", async () => {
    const conAnterior = await leerEntrada(lector({ cierres: [{ fecha: "2026-11-24", precio: "1100.5" }, { fecha: "2026-11-25", precio: "990.25" }] }), AHORA, false);
    expect(String(conAnterior.entrada.especies[0]!.cierreAnterior)).toBe("1100.5");
    expect(String(conAnterior.entrada.especies[0]!.cierreHoy)).toBe("990.25");
    const sinAnterior = await leerEntrada(lector({ cierres: [{ fecha: "2026-11-20", precio: "1100.5" }, { fecha: "2026-11-25", precio: "990.25" }] }), AHORA, false);
    expect(sinAnterior.entrada.especies[0]!.cierreAnterior).toBeNull();
  });

  it("de varios cierres del mismo día vigentes, el traído más tarde (el primero de la lista ordenada)", async () => {
    const r = await leerEntrada(lector({ cierres: [{ fecha: "2026-11-25", precio: "991", traidoEn: "2026-11-25T23:20:00.000Z" }, { fecha: "2026-11-25", precio: "980", traidoEn: "2026-11-25T22:00:00.000Z" }] }), AHORA, false);
    expect(String(r.entrada.especies[0]!.cierreHoy)).toBe("991");
    expect(r.procedencia.get("e-1")?.cierre).toEqual({ traidoEn: new Date("2026-11-25T23:20:00.000Z"), fuente: "yahoo" });
  });

  it("la barra intradía solo se lee con el interruptor encendido, y trae su hora, su fuente y su hora de traída", async () => {
    const barra = { instante: new Date("2026-11-25T16:10:00.000Z"), precio: D("1050.75"), fuente: "yahoo", conRetraso: true, traidoEn: new Date("2026-11-25T16:31:00.000Z") };
    const apagado = lector({ barra });
    expect((await leerEntrada(apagado, AHORA, false)).entrada.especies[0]!.intradia).toBeNull();
    expect(apagado.$queryRaw.mock.calls.some(([t]) => textoSql(t).includes("precio_intradia"))).toBe(false);
    const r = await leerEntrada(lector({ barra }), AHORA, true);
    expect(r.entrada.especies[0]!.intradia).toEqual({ instante: barra.instante, precio: barra.precio, conRetraso: true });
    expect(r.procedencia.get("e-1")?.intradia).toEqual({ instante: barra.instante, traidoEn: barra.traidoEn, fuente: "yahoo" });
    expect(r.entrada.intradiaActivo).toBe(true);
  });

  it("la barra de todas las especies sale de UNA consulta (no una por especie)", async () => {
    const db = lector();
    (db.instrumento.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([ESPECIE, { id: "e-2", nemotecnico: "FICTICIA-B" }, { id: "e-3", nemotecnico: "FICTICIA-C" }]);
    await leerEntrada(db, AHORA, true);
    expect(db.$queryRaw.mock.calls.filter(([t]) => textoSql(t).includes("precio_intradia"))).toHaveLength(1);
  });

  it("la tenencia viene sumada por día y especie en una sola consulta (no se trae el historial de órdenes)", async () => {
    const db = lector();
    await leerEntrada(db, AHORA, false);
    expect(db.$queryRaw.mock.calls.filter(([t]) => textoSql(t).includes("UNION ALL"))).toHaveLength(1);
    expect(db.$queryRaw.mock.calls.some(([t]) => /GROUP BY/.test(textoSql(t)))).toBe(true);
  });

  it("el calendario se lee acotado: solo los días sin rueda cercanos a hoy", async () => {
    const db = lector();
    await leerEntrada(db, AHORA, false);
    const where = (db.calendarioBvc.findMany.mock.calls[0] as unknown as [{ where: { esHabil: boolean; dia: { gte: Date; lte: Date } } }])[0].where;
    expect(where.esHabil).toBe(false);
    expect(where.dia.gte.getTime()).toBeLessThan(dia("2026-11-25").getTime());
    expect(where.dia.gte.getTime()).toBeGreaterThan(dia("2026-09-01").getTime());
    expect(where.dia.lte.getTime()).toBeGreaterThan(dia("2026-11-25").getTime());
    expect(where.dia.lte.getTime()).toBeLessThan(dia("2027-03-01").getTime());
  });

  it("la tenencia suma las compras y los lotes de escisión y resta las ventas; la regla llega con su nivel", async () => {
    const r = await leerEntrada(lector(), AHORA, false);
    const e = r.entrada.especies[0]!;
    expect(tenenciaEn(e.movimientos, dia("2026-11-25"))).toBe(75n);
    expect(e.reglas).toEqual([{ id: "r-1", condicion: "CIERRE_BAJO", nivel: D("1000") }]);
  });

  it("el calendario entra como los días sin rueda", async () => {
    const r = await leerEntrada(lector({ festivos: ["2026-11-16"] }), AHORA, false);
    expect([...r.entrada.noHabiles]).toEqual(["2026-11-16"]);
  });

  it("la lectura de decretos no filtra por vigentes en la consulta: el motor descarta los retirados y los anulados", async () => {
    const db = lector();
    (db.dividendoDecretado.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "d-1", instrumentoId: "e-1", fechaEx: dia("2026-11-26"), fechaPago: dia("2026-12-03"), anulada: true, reemplazadoEn: null },
      { id: "d-2", instrumentoId: "e-1", fechaEx: dia("2026-11-26"), fechaPago: dia("2026-12-03"), anulada: false, reemplazadoEn: new Date() },
    ]);
    const r = await leerEntrada(db, AHORA, false);
    expect(r.entrada.decretos.map((d) => [d.id, d.vigente, d.anulada])).toEqual([["d-1", true, true], ["d-2", false, false]]);
  });
});
