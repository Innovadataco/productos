// Integración de la pantalla de proyecciones (frente proyecciones-pantalla) contra la base de pruebas: el lector del
// fondo para la historia (unidades por movimiento con su signo y valores vigentes hasta hoy), la historia mensual
// completa y el cálculo de la vista por el motor real. Datos INVENTADOS y cifras raras; la base se comparte con los
// demás archivos, así que lo de esta corrida se busca por su id. Fechas de 2019 (antes de 2022): ningún archivo mira el
// fondo en esas fechas (la guarda de conciliacion.test.ts cuenta órdenes, caja, dividendos, ajustes, eventos y lotes).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEMILLA_PANTALLA, TRAYECTORIAS_PANTALLA } from "@/app/proyecciones/controles";
import { leerFondosHistoria, leerHistoria } from "@/app/proyecciones/datos";
import { calcularVista } from "@/app/proyecciones/servidor";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2019-06-28");
let fondoId = "";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `8${corrida}7`, nombre: "Fondo ficticio de la pantalla" } })).id;
  await db.movimientoFondo.createMany({
    data: [
      { fondoId, fecha: dia("2019-02-04"), unidades: new Prisma.Decimal("137.4613"), tipo: "CONSTITUCION", fuente: "MANUAL" },
      { fondoId, fecha: dia("2019-03-12"), unidades: new Prisma.Decimal("41.1373"), tipo: "APORTE", fuente: "MANUAL" },
      { fondoId, fecha: dia("2019-05-07"), unidades: new Prisma.Decimal("13.7911"), tipo: "RETIRO", fuente: "MANUAL" },
      { fondoId, fecha: dia("2019-07-09"), unidades: new Prisma.Decimal("97.1317"), tipo: "APORTE", fuente: "MANUAL" }, // después de hoy
    ],
  });
  await db.valorUnidadFondo.createMany({
    data: [
      { fondoId, fechaValor: dia("2019-02-01"), valorUnidad: new Prisma.Decimal("10137.41370000") },
      { fondoId, fechaValor: dia("2019-04-30"), valorUnidad: new Prisma.Decimal("10211.37130000") },
      { fondoId, fechaValor: dia("2019-04-29"), valorUnidad: new Prisma.Decimal("1.37000000"), reemplazadoEn: new Date() }, // reemplazado
      { fondoId, fechaValor: dia("2019-06-27"), valorUnidad: new Prisma.Decimal("10293.71130000") },
      { fondoId, fechaValor: dia("2019-07-01"), valorUnidad: new Prisma.Decimal("10301.13710000") }, // después de hoy
    ],
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("leerFondosHistoria", () => {
  it("las unidades con su signo (el retiro resta) y los valores vigentes, hasta hoy y en orden", async () => {
    const f = (await leerFondosHistoria(db, HOY)).find((x) => x.fondoId === fondoId)!;
    expect(f.movimientos).toEqual([
      { dia: "2019-02-04", unidades: 137.4613 },
      { dia: "2019-03-12", unidades: 41.1373 },
      { dia: "2019-05-07", unidades: -13.7911 },
    ]);
    expect(f.valores).toEqual([
      { dia: "2019-02-01", valor: 10137.4137 },
      { dia: "2019-04-30", valor: 10211.3713 },
      { dia: "2019-06-27", valor: 10293.7113 },
    ]);
  });
});

describe("leerHistoria", () => {
  it("un punto por mes, en orden, hasta hoy (con lo que haya en la base compartida)", async () => {
    const h = await leerHistoria(db, HOY);
    const dias = h.map((p) => p.dia);
    expect(dias).toEqual([...dias].sort());
    expect(new Set(dias.map((d) => d.slice(0, 7))).size).toBe(dias.length);
    expect(dias.every((d) => d <= "2019-06-28")).toBe(true);
    expect(h.every((p) => Number.isFinite(p.valor))).toBe(true);
  });
});

describe("calcularVista", () => {
  it("proyecta con el motor real y devuelve la vista mínima (sin posiciones)", async () => {
    const r = await calcularVista(db, {
      horizonteMeses: 13, aportePeriodico: 371.53, frecuenciaAporte: "MENSUAL", reinvertirDividendos: false, caidaInicialPct: 7.3, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.vista.puntos).toHaveLength(14);
    expect(r.vista.controles).toEqual({ horizonteMeses: 13, aportePeriodico: 371.53, frecuenciaAporte: "MENSUAL", reinvertirDividendos: false, caidaInicialPct: 7.3 });
    expect(r.vista.textos.length).toBeGreaterThan(3);
    expect(JSON.stringify(r.vista)).not.toContain("instrumentoId");
  });

  it("lo que el motor rechaza vuelve como errores por campo", async () => {
    const r = await calcularVista(db, {
      horizonteMeses: 360, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 10_000, semilla: SEMILLA_PANTALLA,
    });
    expect(r).toEqual({ ok: false, errores: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] });
  });
});
