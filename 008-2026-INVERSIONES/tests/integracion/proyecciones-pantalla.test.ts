// Integración de la pantalla de proyecciones (frente proyecciones-pantalla) contra la base de pruebas: el lector del
// fondo para la historia (unidades por movimiento con su signo y valores vigentes hasta hoy), la historia mensual
// completa y el cálculo de la vista por el motor real. Datos INVENTADOS y cifras raras; la base se comparte con los
// demás archivos, así que lo de esta corrida se busca por su id. Fechas de diciembre de 2027 (año sembrado): la constitución
// y el aporte llevan su ajuste de caja APORTE_FIC de la misma fecha (reglas de movimiento_fondo, como fondo-corte.test.ts),
// y un ajuste antes de 2023 rompería la guarda de conciliacion.test.ts; ningún corte de los demás llega a dic-2027.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEMILLA_PANTALLA, TRAYECTORIAS_PANTALLA } from "@/app/proyecciones/controles";
import { leerFondosHistoria, leerHistoria } from "@/app/proyecciones/datos";
import { calcularVista } from "@/app/proyecciones/servidor";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2027-12-29");
let fondoId = "";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email: `dueno-pp-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `8${corrida}7`, nombre: "Fondo ficticio de la pantalla" } })).id;
  const pagado = async (fecha: string, unidades: string, monto: string, tipo: "CONSTITUCION" | "APORTE") => {
    const ajuste = await db.ajusteCaja.create({
      data: { fecha: dia(fecha), monto: new Prisma.Decimal(`-${monto}`), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId },
    });
    await db.movimientoFondo.create({
      data: { fondoId, fecha: dia(fecha), unidades: new Prisma.Decimal(unidades), monto: new Prisma.Decimal(monto), tipo, fuente: "MANUAL", ajusteCajaId: ajuste.id },
    });
  };
  await pagado("2027-12-06", "137.4613", "1393471.1937", "CONSTITUCION");
  await pagado("2027-12-13", "41.1373", "420073.4113", "APORTE");
  await db.movimientoFondo.create({ data: { fondoId, fecha: dia("2027-12-20"), unidades: new Prisma.Decimal("13.7911"), tipo: "RETIRO", fuente: "MANUAL" } });
  await pagado("2027-12-30", "97.1317", "999913.1371", "APORTE"); // después de hoy
  await db.valorUnidadFondo.createMany({
    data: [
      { fondoId, fechaValor: dia("2027-12-03"), valorUnidad: new Prisma.Decimal("10137.41370000") },
      { fondoId, fechaValor: dia("2027-12-14"), valorUnidad: new Prisma.Decimal("10211.37130000") },
      { fondoId, fechaValor: dia("2027-12-13"), valorUnidad: new Prisma.Decimal("1.37000000"), reemplazadoEn: new Date() }, // reemplazado
      { fondoId, fechaValor: dia("2027-12-28"), valorUnidad: new Prisma.Decimal("10293.71130000") },
      { fondoId, fechaValor: dia("2027-12-30"), valorUnidad: new Prisma.Decimal("10301.13710000") }, // después de hoy
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
      { dia: "2027-12-06", unidades: 137.4613 },
      { dia: "2027-12-13", unidades: 41.1373 },
      { dia: "2027-12-20", unidades: -13.7911 },
    ]);
    expect(f.valores).toEqual([
      { dia: "2027-12-03", valor: 10137.4137 },
      { dia: "2027-12-14", valor: 10211.3713 },
      { dia: "2027-12-28", valor: 10293.7113 },
    ]);
  });
});

describe("leerHistoria", () => {
  it("un punto por mes, en orden, hasta hoy (con lo que haya en la base compartida)", async () => {
    const h = await leerHistoria(db, HOY);
    const dias = h.map((p) => p.dia);
    expect(dias).toEqual([...dias].sort());
    expect(new Set(dias.map((d) => d.slice(0, 7))).size).toBe(dias.length);
    expect(dias.every((d) => d <= "2027-12-29")).toBe(true);
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
