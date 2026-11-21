// SPEC-13 «nunca un precio viejo como de hoy»: una barra de Yahoo de un día no hábil (fin de semana o
// festivo de calendario_bvc) o sin negociación (volume 0) no se guarda como cierre de ese día.
// Base falsa (sin PostgreSQL) y Yahoo falso (sin red). Especie, precios y volúmenes inventados.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

const ESPECIE = "esp-ficticia-sn";
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Barra diaria de Yahoo: 09:30 en Colombia (14:30 UTC) del día dado. */
const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;

interface Barra { readonly dia: string; readonly close: number; readonly volume: number | null }
const yahoo = (barras: readonly Barra[]): Buscar => async () =>
  new Response(JSON.stringify({
    chart: { result: [{ meta: { currency: "COP" }, timestamp: barras.map((b) => ts(b.dia)), indicators: { quote: [{ close: barras.map((b) => b.close), volume: barras.map((b) => b.volume) }] } }] },
  }));

/** Como una fila real: trae su verificación (sin certificación en esta base, NO_VERIFICADO sin referencia). */
interface Fila {
  id: string; instrumentoId: string; fecha: Date; precio: Prisma.Decimal; fuente: string; reemplazadoEn: Date | null;
  estado: "VERIFICADO" | "NO_VERIFICADO"; fuenteReferencia: string | null; precioReferencia: Prisma.Decimal | null; desviacionPct: Prisma.Decimal | null;
}
type Donde = { id?: string; instrumentoId?: string; fecha?: Date | { in: Date[] }; fuente?: string; reemplazadoEn?: null };
const mismaFecha = (f: Date, w: Date | { in: Date[] }) => (w instanceof Date ? [w] : w.in).some((d) => d.getTime() === f.getTime());
const cumple = (w: Donde) => (f: Fila) =>
  (w.id === undefined || f.id === w.id) && (w.instrumentoId === undefined || f.instrumentoId === w.instrumentoId) &&
  (w.fecha === undefined || mismaFecha(f.fecha, w.fecha)) && (w.fuente === undefined || f.fuente === w.fuente) &&
  (!("reemplazadoEn" in w) || f.reemplazadoEn === null);

/**
 * Base falsa con lo que usa actualizarPrecios; el calendario es el que se le pase (filas de calendario_bvc).
 * `previas` son cierres ya guardados; `fallarRetiro` hace fallar el reemplazo sin sucesor (retiro).
 */
function baseFalsa(calendario: readonly { dia: Date; esHabil: boolean }[], previas: readonly Fila[] = [], fallarRetiro = false) {
  const filas: Fila[] = previas.map((f) => ({ ...f }));
  const llamadas = { retiros: 0 };
  const precioCierre = {
    findFirst: async ({ where }: { where: Donde }) => filas.find(cumple(where)) ?? null,
    updateMany: async ({ where, data }: { where: Donde; data: { reemplazadoEn: Date } }) => {
      if (where.id === undefined) llamadas.retiros += 1;
      if (fallarRetiro && where.id === undefined) throw Object.assign(new Error("valor 777111 en la consulta"), { name: "PrismaClientKnownRequestError", code: "P1001" });
      const blanco = filas.filter(cumple(where));
      for (const f of blanco) f.reemplazadoEn = data.reemplazadoEn;
      return { count: blanco.length };
    },
    create: async ({ data }: { data: Omit<Fila, "id" | "reemplazadoEn"> }) => {
      const fila = { ...data, precio: new Prisma.Decimal(data.precio), id: `p${filas.length + 1}`, reemplazadoEn: null };
      filas.push(fila);
      return fila;
    },
    count: async () => 0,
  };
  const db = {
    instrumento: { findMany: async () => [{ id: ESPECIE, nemotecnico: "FICT1" }] },
    calendarioBvc: { findMany: async () => calendario.map((c) => ({ ...c, nota: "ficticio" })) },
    simboloPrecio: { findFirst: async () => null },
    certificacionPosicion: { findFirst: async () => null },
    precioCierre,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db: db as unknown as PrismaClient, filas, llamadas };
}

const vigentes = (filas: readonly Fila[]) =>
  filas.filter((f) => f.reemplazadoEn === null).map((f) => [f.fecha.toISOString().slice(0, 10), f.precio.toString()]).sort();

// Semana inventada: el jueves y el viernes se marcan como festivos en el calendario falso.
const CALENDARIO_2024 = [{ dia: utc("2024-03-28"), esHabil: false }, { dia: utc("2024-03-29"), esHabil: false }];
const DESPUES = new Date("2024-04-10T20:00:00Z"); // todas las barras ya son definitivas por horario

describe("actualizarPrecios · días no hábiles y sin negociación (base falsa)", () => {
  it("regresión: no guarda la barra del festivo (cierre repetido, volume 0) ni la del día hábil con volume 0; lo reporta", async () => {
    const { db, filas } = baseFalsa(CALENDARIO_2024);
    const barras: Barra[] = [
      { dia: "2024-03-26", close: 100, volume: 1500 }, // martes hábil con negociación
      { dia: "2024-03-27", close: 100, volume: 0 }, // miércoles hábil SIN negociación: repite el cierre
      { dia: "2024-03-28", close: 100, volume: 0 }, // jueves festivo: cierre repetido, volume 0
      { dia: "2024-03-29", close: 100, volume: null }, // viernes festivo: cierre repetido, volume null
      { dia: "2024-03-30", close: 100, volume: 5 }, // sábado: fin de semana
      { dia: "2024-04-01", close: 101, volume: null }, // lunes hábil, volume null: se mantiene lo de hoy
    ];
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(barras), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(vigentes(filas)).toEqual([["2024-03-26", "100"], ["2024-04-01", "101"]]);
    expect(r).toMatchObject({ cierresNuevos: 2, cierresRevisados: 0, omitidasPorHorario: 0, omitidasNoHabil: 3, omitidasSinNegociacion: 1, omitidasSinCalendario: 0, fallidas: [] });
  });

  it("si calendario_bvc no cubre el año, la barra de un día entre semana no se guarda y se reporta (sin calendario)", async () => {
    const { db, filas } = baseFalsa(CALENDARIO_2024); // nada de 2019
    const barras: Barra[] = [
      { dia: "2019-03-12", close: 90, volume: 700 }, // martes de un año sin calendario
      { dia: "2019-03-16", close: 90, volume: 700 }, // sábado: no hábil aunque falte el calendario
    ];
    const r = await actualizarPrecios(db, { desde: utc("2019-03-12"), hasta: utc("2019-03-16"), buscar: yahoo(barras), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(vigentes(filas)).toEqual([]);
    expect(r).toMatchObject({ cierresNuevos: 0, omitidasSinCalendario: 1, omitidasNoHabil: 1, omitidasSinNegociacion: 0 });
  });

  it("la barra de hoy con volume 0: antes de la hora definitiva cuenta por horario; después, como sin negociación", async () => {
    const hoy = [{ dia: "2024-03-26", close: 100, volume: 0 }];
    const antes = baseFalsa(CALENDARIO_2024);
    const rAntes = await actualizarPrecios(antes.db, { desde: utc("2024-03-26"), hasta: utc("2024-03-26"), buscar: yahoo(hoy), instrumentoIds: [ESPECIE], ahora: new Date("2024-03-26T15:00:00Z") }); // 10:00 COT
    expect(rAntes).toMatchObject({ omitidasPorHorario: 1, omitidasSinNegociacion: 0 });
    const despues = baseFalsa(CALENDARIO_2024);
    const rDespues = await actualizarPrecios(despues.db, { desde: utc("2024-03-26"), hasta: utc("2024-03-26"), buscar: yahoo(hoy), instrumentoIds: [ESPECIE], ahora: new Date("2024-03-26T22:30:00Z") }); // 17:30 COT
    expect(rDespues).toMatchObject({ omitidasPorHorario: 0, omitidasSinNegociacion: 1 });
    expect(vigentes(despues.filas)).toEqual([]);
  });

  const previa = (dia: string, precio = 100): Fila => ({
    id: `v-${dia}`, instrumentoId: ESPECIE, fecha: utc(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", reemplazadoEn: null,
    estado: "NO_VERIFICADO", fuenteReferencia: null, precioReferencia: null, desviacionPct: null,
  });
  const SEMANA: Barra[] = [
    { dia: "2024-03-26", close: 100, volume: 1500 },
    { dia: "2024-03-27", close: 100, volume: 0 },
    { dia: "2024-03-28", close: 100, volume: 0 },
    { dia: "2024-04-01", close: 101, volume: null },
  ];

  it("datos ya guardados: retira (reemplazadoEn, sin sucesor) el vigente de un día que ahora se omite por no hábil o sin negociación", async () => {
    const { db, filas } = baseFalsa(CALENDARIO_2024, [previa("2024-03-26"), previa("2024-03-27"), previa("2024-03-28")]);
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(vigentes(filas)).toEqual([["2024-03-26", "100"], ["2024-04-01", "101"]]);
    expect(filas.filter((f) => f.reemplazadoEn !== null).map((f) => f.id)).toEqual(["v-2024-03-27", "v-2024-03-28"]);
    expect(filas).toHaveLength(4); // nada se borra
    expect(r).toMatchObject({ cierresNuevos: 1, cierresRevisados: 0, cierresRetirados: 2, omitidasNoHabil: 1, omitidasSinNegociacion: 1, fallidas: [] });
  });

  it("retira con una sola sentencia por especie, no una por barra (revisión: N+1)", async () => {
    const { db, filas, llamadas } = baseFalsa(CALENDARIO_2024, [previa("2024-03-27"), previa("2024-03-28")]);
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(llamadas.retiros).toBe(1);
    expect(r.cierresRetirados).toBe(2);
    expect(filas.filter((f) => f.reemplazadoEn !== null)).toHaveLength(2);
  });

  it("sin barras que retirar no hay sentencia de retiro", async () => {
    const { db, llamadas } = baseFalsa(CALENDARIO_2024);
    await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-03-26"), buscar: yahoo([{ dia: "2024-03-26", close: 100, volume: 10 }]), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(llamadas.retiros).toBe(0);
  });

  it("un retiro se revierte solo: si Yahoo trae después volumen para ese día, la carga vuelve a guardar el cierre", async () => {
    const retirado = { ...previa("2024-03-27"), reemplazadoEn: new Date("2024-04-02T00:00:00Z") };
    const { db, filas } = baseFalsa(CALENDARIO_2024, [retirado]);
    const r = await actualizarPrecios(db, { desde: utc("2024-03-27"), hasta: utc("2024-03-27"), buscar: yahoo([{ dia: "2024-03-27", close: 100, volume: 800 }]), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(r).toMatchObject({ cierresNuevos: 1, cierresRetirados: 0 });
    expect(vigentes(filas)).toEqual([["2024-03-27", "100"]]);
    expect(filas).toHaveLength(2); // el retirado sigue en la historia
  });

  it("HORARIO y SIN_CALENDARIO no retiran: no hay certeza de que el vigente sobre", async () => {
    const hoy = baseFalsa(CALENDARIO_2024, [previa("2024-03-26")]);
    const rHoy = await actualizarPrecios(hoy.db, { desde: utc("2024-03-26"), hasta: utc("2024-03-26"), buscar: yahoo([{ dia: "2024-03-26", close: 100, volume: 0 }]), instrumentoIds: [ESPECIE], ahora: new Date("2024-03-26T15:00:00Z") });
    expect(rHoy).toMatchObject({ omitidasPorHorario: 1, cierresRetirados: 0 });
    expect(vigentes(hoy.filas)).toEqual([["2024-03-26", "100"]]);
    const viejo = baseFalsa(CALENDARIO_2024, [previa("2019-03-12", 90)]);
    const rViejo = await actualizarPrecios(viejo.db, { desde: utc("2019-03-12"), hasta: utc("2019-03-12"), buscar: yahoo([{ dia: "2019-03-12", close: 90, volume: 700 }]), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(rViejo).toMatchObject({ omitidasSinCalendario: 1, cierresRetirados: 0 });
    expect(vigentes(viejo.filas)).toEqual([["2019-03-12", "90"]]);
  });

  it("un retiro que falla no aborta las demás barras: GUARDADO_ERROR con nombre y código, sin el mensaje", async () => {
    const { db, filas } = baseFalsa(CALENDARIO_2024, [previa("2024-03-27")], true);
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [ESPECIE], ahora: DESPUES });
    expect(r.fallidas).toEqual([{ instrumentoId: ESPECIE, codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P1001", barrasGuardadas: 2, barrasFallidas: 2 }]);
    expect(JSON.stringify(r)).not.toContain("777111");
    expect(vigentes(filas)).toEqual([["2024-03-26", "100"], ["2024-03-27", "100"], ["2024-04-01", "101"]]);
  });
});
