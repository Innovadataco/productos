// Las lecturas y las marcas de /alertas contra la base de PRUEBAS: la ventana de 30 días (con sus bordes), el contador de 7, el
// agrupado por día con el texto reescrito desde la evidencia, «Marcar vista» y «Marcar todas» idempotentes y solo del dueño (el
// disparador de la base rechaza a la familia aunque la ruta fallara). «Hoy» entra por parámetro (una fecha fija de junio de
// 2026: ningún otro archivo de pruebas guarda alertas en esos días). Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contarPendientes, datosDeAlertas } from "@/app/alertas/datos";
import { marcarTodas, marcarVista } from "@/app/alertas/marcar";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const HOY = new Date("2026-06-15T00:00:00.000Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
let duenoId = "";
let familiaId = "";
let especieId = "";
const ids: Record<string, string> = {};

const movimiento = (d: string, cambios: Partial<Prisma.AlertaUncheckedCreateInput> = {}) =>
  db.alerta.create({
    data: {
      dia: dia(d), tipo: "MOVIMIENTO_DIA", instrumentoId: especieId, sentido: "BAJO", base: "CIERRE", precio: new Prisma.Decimal("90.5"), variacionPct: new Prisma.Decimal("-10"),
      umbral: new Prisma.Decimal("3"), traidoEn: new Date(`${d}T23:20:00.000Z`), fuente: "yahoo", esFechaEx: false, motorVersion: "alertas-v1", ...cambios,
    },
  });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-pant-alertas-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  familiaId = (await db.usuario.create({ data: { email: `familia-pant-alertas-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } })).id;
  especieId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `ZP${corrida}`, nombre: "Especie ficticia de la pantalla" } })).id;
  for (const [nombre, d] of [["hoy", "2026-06-15"], ["hace3", "2026-06-12"], ["borde7", "2026-06-09"], ["hace7", "2026-06-08"], ["borde30", "2026-05-17"], ["fuera", "2026-05-16"]] as const) {
    ids[nombre] = (await movimiento(d)).id;
  }
  // El futuro respecto de «hoy» tampoco entra.
  ids["manana"] = (await movimiento("2026-06-16")).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("datosDeAlertas", () => {
  it("trae los últimos 30 días (con sus bordes), agrupados por día, el más reciente primero, con el texto de la evidencia", async () => {
    const v = await datosDeAlertas(db, HOY);
    expect(v.dias.map((d) => d.dia)).toEqual(["2026-06-15", "2026-06-12", "2026-06-09", "2026-06-08", "2026-05-17"]);
    expect(v.total).toBe(5);
    expect(v.dias[0]!.titulo).toBe("15-jun-2026");
    const a = v.dias[0]!.alertas[0]!;
    expect(a.id).toBe(ids["hoy"]);
    expect(a.texto).toBe(`«ZP${corrida}»: cierre del día (90,5) está 10 % por debajo del cierre anterior.`);
    expect(a.procedencia).toEqual({ dia: "2026-06-15", traidoEn: "2026-06-15 18:20", fuente: "yahoo", tipo: "CIERRE" });
    expect(a.vista).toBeNull();
    expect(v.sinVer).toBe(5);
  });
});

describe("contarPendientes", () => {
  it("cuenta las de los últimos 7 días sin marcar (de hace 6 días a hoy)", async () => {
    expect(await contarPendientes(db, HOY)).toBe(3);
  });
});

describe("marcarVista y marcarTodas", () => {
  it("el dueño marca una: queda vista con su hora, el contador baja, y marcar otra vez no escribe nada", async () => {
    expect(await marcarVista(db, ids["hoy"]!, duenoId)).toEqual({ existe: true, marcadas: 1 });
    expect(await marcarVista(db, ids["hoy"]!, duenoId)).toEqual({ existe: true, marcadas: 0 });
    expect(await contarPendientes(db, HOY)).toBe(2);
    const v = await datosDeAlertas(db, HOY);
    expect(v.sinVer).toBe(4);
    expect(v.dias[0]!.alertas[0]!.vista).toMatch(/^\d{1,2}-[a-z]{3}-\d{4} \d{2}:\d{2}$/);
  });

  it("una alerta que no existe: existe falso, sin escribir", async () => {
    expect(await marcarVista(db, "no-existe", duenoId)).toEqual({ existe: false, marcadas: 0 });
  });

  it("la familia no marca: el disparador de la base lo rechaza", async () => {
    await expect(marcarVista(db, ids["hace3"]!, familiaId)).rejects.toThrow(/dueño/);
    await expect(marcarTodas(db, familiaId, HOY)).rejects.toThrow(/dueño/);
    expect(await db.alertaVista.count({ where: { alertaId: ids["hace3"]! } })).toBe(0);
  });

  it("«Marcar todas» marca las de la ventana de 30 días que faltan (ni las de fuera ni las del futuro) y repetirla marca 0", async () => {
    expect(await marcarTodas(db, duenoId, HOY)).toEqual({ marcadas: 4 });
    expect(await marcarTodas(db, duenoId, HOY)).toEqual({ marcadas: 0 });
    expect(await contarPendientes(db, HOY)).toBe(0);
    expect((await datosDeAlertas(db, HOY)).sinVer).toBe(0);
    expect(await db.alertaVista.count({ where: { alertaId: { in: [ids["fuera"]!, ids["manana"]!] } } })).toBe(0);
  });
});
