// El export de hechos para la evaluación (E7) contra la base de PRUEBAS: todo en UNA transacción READ ONLY (control
// positivo: un INSERT adentro falla y no queda nada), los tres paquetes armados con los lectores de siempre y los
// armadores de E1b, nada escrito en la base, y el CLI como proceso imprime por stdout un JSON que el arnés lee con
// `--paquetes`. La base se comparte con los demás archivos: lo de esta corrida se busca por su nemotécnico, y la
// versión del plan no adelanta la vigencia (la de la última versión, o la primera fecha que usan los demás).
// Datos INVENTADOS.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearVersionPlan } from "@/plan/versiones";
import { fechaEnBogota } from "@/precios/horario";
import { leerExportacion, serializarExportacion } from "@/ia/evaluacion/exportacion";
import { exportarHechos } from "@/ia/evaluacion/exportar/exportar";
import { enFotoDeSoloLectura } from "@/ia/evaluacion/exportar/foto";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO = `FICTICIA-EXP${corrida.replace(/[^A-Z]/g, "Q")}`;
const HOY = fechaEnBogota(new Date());
const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const PRIMERA_VIGENCIA = new Date("2025-03-03T00:00:00.000Z");
let duenoId = "";

const conteos = async (): Promise<readonly number[]> =>
  Promise.all([db.usuario.count(), db.instrumento.count(), db.planVersion.count(), db.reglaPlan.count(), db.precioCierre.count(), db.resumenIa.count()]);

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-exportar-ia-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const instrumento = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: NEMO, nombre: "Especie ficticia del export" } });
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { vigenteDesde: true } });
  const vigenteDesde = ultima?.vigenteDesde ?? PRIMERA_VIGENCIA;
  await db.precioCierre.create({ data: { instrumentoId: instrumento.id, fecha: vigenteDesde, precio: new Prisma.Decimal("4613.27"), fuente: "yahoo", estado: "NO_VERIFICADO" } });
  await crearVersionPlan(db, {
    vigenteDesde, motivo: "Plan ficticio del export de hechos", autorId: duenoId,
    reglas: [{ instrumentoId: instrumento.id, condicion: "CIERRE_BAJO", nivel: "4497.11", accion: "COMPRAR", cantidad: null, plazoHasta: null, detalle: "Regla ficticia del export" }],
  }, { hoy: HOY });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("enFotoDeSoloLectura", () => {
  it("control positivo: un INSERT dentro de la foto falla y no queda nada", async () => {
    const correo = `no-debe-quedar-${corrida.toLowerCase()}@ejemplo.invalid`;
    await expect(enFotoDeSoloLectura(db, (c) => c.usuario.create({ data: { email: correo, rol: "FAMILIA" } }))).rejects.toThrow(/read-only|solo lectura/i);
    expect(await db.usuario.count({ where: { email: correo } })).toBe(0);
  });

  it("también con SQL crudo y dentro de un $transaction anidado de un lector", async () => {
    await expect(enFotoDeSoloLectura(db, (c) => c.$executeRaw`UPDATE "usuario" SET "email" = "email" WHERE false`)).rejects.toThrow(/read-only|solo lectura/i);
    await expect(enFotoDeSoloLectura(db, (c) => c.$transaction(async (tx) => tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `X${corrida}`, nombre: "no" } })))).rejects.toThrow(/read-only|solo lectura/i);
  });
});

describe("exportarHechos", () => {
  it("arma los paquetes que puede, dice por qué falta el resto, y no escribe nada", async () => {
    const antes = await conteos();
    const r = await exportarHechos(db, HOY);
    expect(await conteos()).toEqual(antes);
    const tipos = [...r.paquetes.map((p) => p.tipo), ...r.omitidos.map((o) => o.tipo)].sort();
    expect(tipos).toEqual(["DIARIO", "ESCENARIOS", "REGLAS"]);
    for (const o of r.omitidos) expect(o.codigo).toMatch(/^[A-Z_]+$/);
    const reglas = r.paquetes.find((p) => p.tipo === "REGLAS");
    expect(reglas?.hechos.some((h) => h.clave === "ESPECIE_NOMBRE" && h.valor === NEMO)).toBe(true);
    expect(reglas?.hechos.some((h) => h.clave === "REGLA_DEL_PLAN")).toBe(true);
    expect(leerExportacion(new TextEncoder().encode(serializarExportacion(r.paquetes))).map((c) => c.paquete.hash)).toEqual(r.paquetes.map((p) => p.hash));
  });
});

describe("exportar-hechos-ia como proceso", () => {
  const tsx = path.join(RAIZ, "node_modules", ".bin", "tsx");
  const correr = (args: readonly string[]) =>
    spawnSync(tsx, ["--conditions=react-server", path.join("scripts", "exportar-hechos-ia.ts"), ...args], {
      cwd: RAIZ, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", NO_COLOR: "1", DATABASE_URL: process.env.DATABASE_URL ?? "" },
    });

  it("imprime por stdout el JSON que el arnés lee con --paquetes; por stderr solo códigos y conteos", async () => {
    const antes = await conteos();
    const r = correr([]);
    expect([0, 3], r.stderr).toContain(r.status);
    const casos = leerExportacion(new TextEncoder().encode(r.stdout));
    expect(casos.map((c) => c.id)).toContain("REGLAS");
    expect(r.stderr).not.toContain(NEMO);
    expect(await conteos()).toEqual(antes);
  });

  it("no lleva opciones: 2 sin tocar la base", () => {
    const r = correr(["--aplicar"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("exportar-hechos-ia no lleva opciones");
  });
});
