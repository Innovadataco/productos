/**
 * Siembra de la base del E2E de la pantalla (INV-SPEC-15). La corre el webServer de
 * playwright.config.ts justo antes de `next dev`, con el mismo DATABASE_URL que usará la app.
 * Datos inventados (fixtures `.ficticio.`). En orden, y aborta al primer fallo:
 *   1. el 5008 debe estar libre (si no, las pruebas irían contra otro servidor, quizá con la base real);
 *   2. candado de la URL (tests/e2e/base.ts) → borra y crea la base e2e desde `postgres`;
 *   3. `prisma migrate deploy` (no borra nada, aunque el CLI leyera otra URL de la .env);
 *   4. comprueba `current_database()` y siembra con los importadores de 008.
 * Cuentas del login (D-014): el dueño nace como lo crea `scripts/crear-acceso-inicial.ts` (sin clave,
 * con un enlace de un solo uso) y la siembra le pone su clave ficticia directo en la base. Las pruebas
 * que cambian una cuenta (bloqueo, enlace) crean la suya, con correo único (tests/e2e/cuentas.ts).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { emitirAcceso } from "../../src/auth/acceso";
import { hashClave } from "../../src/auth/clave";
import { importarArchivoTrii } from "../../src/importacion/trii/importar";
import { construirLotes } from "../../src/lotes/construir";
import { filasDeCalendarioFaltantes } from "./calendario-e2e";
import { APP, DUENO_E2E, baseDePruebas, type BaseDePruebas } from "./base";
import { sembrarConciliacion } from "./sembrar-conciliacion";
import { sembrarDatosOficiales } from "./sembrar-datos-oficiales";
import { sembrarGraficas } from "./sembrar-graficas";
import { sembrarPlan } from "./sembrar-plan";
import { sembrarProyecciones } from "./sembrar-proyecciones";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const ESPERA_PUERTO_MS = 1000;
const DIAS = ["2024-11-18", "2024-11-19", "2024-11-20", "2024-11-21", "2024-11-22"] as const;
const enDias = (precios: readonly number[]) => precios.map((p, k) => [DIAS[k]!, p] as const);
/**
 * Cierres inventados [día, precio], del más viejo al más reciente: FICTA sube, FICTB baja y FICTC es
 * ilíquida (su último cierre es del 1-nov-2024, tres semanas antes que los demás).
 */
const CIERRES: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  FICTA: enDias([1000, 1020, 1040, 1050, 1100]),
  FICTB: enDias([2104, 2061, 2013, 1957, 1913]),
  FICTC: [["2024-10-31", 500], ["2024-11-01", 505]],
};

/** true si algo acepta conexiones en host:puerto. */
function escucha(host: string, puerto: number): Promise<boolean> {
  return new Promise((resolver) => {
    const s = connect({ host, port: puerto });
    const fin = (ocupado: boolean) => { s.destroy(); resolver(ocupado); };
    s.setTimeout(ESPERA_PUERTO_MS, () => fin(false));
    s.once("connect", () => fin(true));
    s.once("error", () => fin(false));
  });
}

async function exigirPuertoLibre(): Promise<void> {
  const ocupado = (await Promise.all([escucha(APP.host, APP.puerto), escucha("::1", APP.puerto)])).some(Boolean);
  if (ocupado) throw new Error(`El puerto ${APP.puerto} está ocupado: detenga ese servidor antes del E2E. No se tocó ninguna base.`);
}

async function recrearBase(base: BaseDePruebas): Promise<void> {
  const mantenimiento = new PrismaClient({ datasourceUrl: base.urlMantenimiento });
  try {
    // El nombre ya pasó por el candado (solo [a-z0-9_]): se puede citar sin riesgo.
    await mantenimiento.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${base.nombre}" WITH (FORCE)`);
    await mantenimiento.$executeRawUnsafe(`CREATE DATABASE "${base.nombre}"`);
  } finally {
    await mantenimiento.$disconnect();
  }
}

function migrar(base: BaseDePruebas): void {
  const r = spawnSync("node_modules/.bin/prisma", ["migrate", "deploy"], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, DATABASE_URL: base.url } });
  if (r.status !== 0) throw new Error(`prisma migrate deploy falló (código ${String(r.status)}).`);
}

async function importar(db: PrismaClient, usuarioId: string, archivo: string): Promise<void> {
  const contenido = readFileSync(new URL(archivo, FIXTURES));
  const r = await importarArchivoTrii(db, { nombreArchivo: archivo, contenido, usuarioId });
  if (r.estado !== "CARGADO") throw new Error(`${archivo} quedó ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
}

async function sembrarCierres(db: PrismaClient): Promise<void> {
  const filas = await Promise.all(
    Object.entries(CIERRES).map(async ([nemo, cierres]) => {
      const { id } = await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo }, select: { id: true } });
      return cierres.map(([dia, precio]) => ({
        instrumentoId: id, fecha: new Date(`${dia}T00:00:00Z`), precio: new Prisma.Decimal(precio), fuente: "e2e-ficticio", estado: "NO_VERIFICADO" as const,
      }));
    }),
  );
  await db.precioCierre.createMany({ data: filas.flat() });
}

/** Completa el calendario de la BVC hasta el año del reloj más uno (candado del aviso de dato viejo; calendario-e2e.ts). */
async function sembrarCalendario(db: PrismaClient): Promise<void> {
  const cubiertos = new Set((await db.calendarioBvc.findMany({ select: { dia: true } })).map((f) => f.dia.getUTCFullYear()));
  const faltantes = filasDeCalendarioFaltantes(cubiertos, new Date());
  if (faltantes.length > 0) await db.calendarioBvc.createMany({ data: faltantes.map((f) => ({ dia: f.dia, esHabil: f.esHabil, nota: f.nota })) });
}

/** Las cuentas del login. Devuelve el id del dueño (el que carga los datos). */
async function sembrarCuentas(db: PrismaClient): Promise<string> {
  const primero = await emitirAcceso(db, { email: DUENO_E2E.email, ahora: new Date() });
  if (!primero.creado || primero.proposito !== "INICIAL") throw new Error("La base del E2E debía empezar sin dueño.");
  await db.usuario.update({ where: { id: primero.usuarioId }, data: { claveHash: await hashClave(DUENO_E2E.clave) } });
  return primero.usuarioId;
}

async function sembrar(base: BaseDePruebas): Promise<void> {
  const db = new PrismaClient({ datasourceUrl: base.url });
  try {
    const actual = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db;
    if (actual !== base.nombre) throw new Error("La conexión no quedó en la base del E2E. No se siembra.");
    const id = await sembrarCuentas(db);
    await importar(db, id, "ordenes.ficticio.csv");
    await importar(db, id, "dividendos.ficticio.csv");
    const lotes = await construirLotes(db);
    if (lotes.especiesSinLotes.length !== 1) throw new Error("La siembra esperaba exactamente una especie incompleta (FICTI).");
    await sembrarCierres(db);
    await sembrarCalendario(db);
    await sembrarConciliacion(db, id);
    await sembrarPlan(db, id);
    // Al final: cierres generados para la evolución del tablero, sin tocar lo que miran las demás pantallas.
    await sembrarGraficas(db);
    // Cierres yahoo de 2019-2021 para que el motor de proyecciones tenga historia (sin tocar lo de las demás pantallas).
    await sembrarProyecciones(db);
    await sembrarDatosOficiales(db);
  } finally {
    await db.$disconnect();
  }
}

async function main(): Promise<void> {
  await exigirPuertoLibre();
  const base = baseDePruebas(process.env.DATABASE_URL ?? "");
  await recrearBase(base);
  migrar(base);
  await sembrar(base);
  console.error(`[e2e] base ${base.nombre} sembrada con datos ficticios.`);
}

main().catch((e: unknown) => {
  console.error(`[e2e] la siembra falló: ${e instanceof Error ? e.message : "error desconocido"}`);
  process.exit(1);
});
