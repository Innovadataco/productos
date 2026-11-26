// scripts/evaluar-alertas.ts como proceso contra la base de PRUEBAS: salida 0 (evaluó y guardó, también la segunda vez, que no
// inserta nada), 3 (una alerta que la base rechaza por su CHECK: las demás quedan) y 1 (la base no responde o la conexión no es la de
// inv_alertas), con la consola solo de conteos: nunca la URL de la base, un nemotécnico ni una cifra de precio. El hijo recibe un
// entorno mínimo (tests/ayudas/cli.ts); NODE_ENV=test e INV_ALERTAS_ROL_PRUEBA lo hacen aceptar el usuario de la base de pruebas como
// el rol equivalente (en producción esa variable no se mira). Deja la base compartida como la encontró: borra lo que el script
// guardó (alertas y marcas posteriores al inicio) y lo que sembró la prueba de la salida 3. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fechaEnBogota } from "@/precios/horario";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../ayudas/cli";
import { exigirBaseDePruebas } from "./apoyo/base-de-pruebas";
import { limpiarEspecies } from "./apoyo/limpiar-especies";
import { limpiarPlan } from "./apoyo/limpiar-plan";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const USUARIO_BASE = decodeURIComponent(new URL(URL_BASE).username);
const SCRIPT = "evaluar-alertas.ts";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const CONTEOS = /^alertas: evaluadas \d+ · nuevas \d+ · ya guardadas \d+ · fallidas 0$/m;
const entorno = (extra: Record<string, string> = {}) => entornoMinimo({ DATABASE_URL: URL_BASE, INV_ALERTAS_ROL_PRUEBA: USUARIO_BASE, ...extra });
let inicio = new Date();
let planId = "";
let especieId = "";

beforeAll(async () => {
  await exigirBaseDePruebas(db);
  inicio = new Date(Date.now() - 1000);
});

afterAll(async () => {
  // Lo que el script guardó en estas pruebas (las alertas y sus marcas), con el procedimiento de corrección del dueño.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
    await tx.$executeRaw`DELETE FROM alerta_vista WHERE "alertaId" IN (SELECT id FROM alerta WHERE "detectadaEn" >= ${inicio})`;
    await tx.$executeRaw`DELETE FROM alerta WHERE "detectadaEn" >= ${inicio}`;
  });
  if (planId !== "") await limpiarPlan(db, [planId]);
  if (especieId !== "") await limpiarEspecies(db, { instrumentos: [especieId], cargas: [] });
  await db.$disconnect();
});

describe("scripts/evaluar-alertas.ts", () => {
  it("sale 0 y cuenta lo evaluado, dice si el intradía está encendido; la segunda vez no inserta nada", { timeout: POR_CLI_MS * 2 + 10_000 }, async () => {
    const nemos = (await db.instrumento.findMany({ where: { tipo: "ACCION", nemotecnico: { not: null } }, select: { nemotecnico: true }, take: 30 })).flatMap((i) => (i.nemotecnico === null ? [] : [i.nemotecnico]));
    const primera = correr(SCRIPT, [], entorno());
    comprobar(primera, 0, "alertas: evaluadas", [URL_BASE, "postgresql://", ...nemos]);
    expect(primera.texto).toMatch(CONTEOS);
    expect(primera.texto).toContain("alertas: intradía apagado · avisos de configuración 0");
    const segunda = correr(SCRIPT, [], entorno());
    comprobar(segunda, 0, "alertas: evaluadas", [URL_BASE, ...nemos]);
    expect(segunda.texto).toMatch(/nuevas 0 · ya guardadas \d+ · fallidas 0/);
  });

  it("con el intradía encendido por la configuración también sale 0 y lo dice", { timeout: POR_CLI_MS + 10_000 }, () => {
    const s = correr(SCRIPT, [], entorno({ INV_INTRADIA_ENCENDIDO: "1" }));
    comprobar(s, 0, "alertas: intradía encendido", [URL_BASE]);
  });

  it("con un valor raro del interruptor apaga (falla cerrada) y cuenta el aviso sin repetir el valor", { timeout: POR_CLI_MS + 10_000 }, () => {
    const s = correr(SCRIPT, [], entorno({ INV_INTRADIA_ENCENDIDO: "quizas-4613" }));
    comprobar(s, 0, "alertas: intradía apagado · avisos de configuración 1", [URL_BASE, "quizas-4613"]);
  });

  it("sale 1 si la conexión no es la de inv_alertas (sin la variable de prueba o en producción), sin imprimir la URL", { timeout: POR_CLI_MS * 2 + 10_000 }, () => {
    const sin = correr(SCRIPT, [], entornoMinimo({ DATABASE_URL: URL_BASE }));
    comprobar(sin, 1, "La conexión no es la del rol inv_alertas", [URL_BASE, "postgresql://"]);
    const produccion = correr(SCRIPT, [], entorno({ NODE_ENV: "production" }));
    comprobar(produccion, 1, "La conexión no es la del rol inv_alertas", [URL_BASE]);
  });

  it("sale 1 si la base no responde, sin imprimir la URL ni la clave", { timeout: POR_CLI_MS + 10_000 }, () => {
    const mala = "postgresql://nadie:clave-ficticia-4613@127.0.0.1:1/ninguna?schema=public&connect_timeout=2";
    const s = correr(SCRIPT, [], entornoMinimo({ DATABASE_URL: mala, INV_ALERTAS_ROL_PRUEBA: "nadie" }));
    comprobar(s, 1, "❌ No se evaluaron las alertas", [mala, "clave-ficticia-4613"]);
  });

  it("sale 3 si la base rechaza una alerta por su CHECK (la barra es posterior a su hora de traída): lo demás queda y no se imprime la especie", { timeout: POR_CLI_MS + 10_000 }, async () => {
    const hoy = fechaEnBogota(new Date());
    const barra = new Date(hoy.getTime() + 5 * 3_600_000);
    const dueno = await db.usuario.create({ data: { email: `dueno-cli-alertas-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } });
    const nemo = `ZQ${corrida}`;
    especieId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo, nombre: "Especie ficticia del CLI" } })).id;
    const plan = await db.planVersion.create({ data: { version: 700000 + (Date.now() % 90000), vigenteDesde: new Date("2026-01-05T00:00:00.000Z"), motivo: "ficticio", aprobadaPorId: dueno.id } });
    planId = plan.id;
    await db.reglaPlan.create({ data: { planVersionId: plan.id, instrumentoId: especieId, condicion: "CIERRE_BAJO", nivel: new Prisma.Decimal("1000"), accion: "NO_ACTUAR", detalle: "ficticio" } });
    // La barra cruza el nivel; su hora de traída es anterior a su hora: la alerta lleva el dato posterior a su traída y la CHECK la rechaza.
    await db.precioIntradia.create({ data: { instrumentoId: especieId, instante: barra, precio: "900.5", fuente: "yahoo", conRetraso: false, traidoEn: new Date(barra.getTime() - 60_000) } });
    const s = correr(SCRIPT, [], entorno({ INV_INTRADIA_ENCENDIDO: "1" }));
    comprobar(s, 3, "fallidas 1", [URL_BASE, nemo, "900"]);
    expect(s.texto).toContain("alguna alerta no se pudo guardar");
    expect(await db.alerta.count({ where: { instrumentoId: especieId } })).toBe(0);
  });
});
