// Los privilegios de inv_ia (docker/migrador/privilegios.sql) contra la base de PRUEBAS, en el Mac y en el CI, con los
// lectores REALES y el registro. Sin crear roles (son globales del clúster y el del Mac tiene la base de trabajo): el rol
// predefinido pg_signal_backend (sin ningún privilegio de tablas) recibe EXACTAMENTE los GRANT que privilegios.sql le da a
// inv_ia, leídos del archivo, y un cliente de una sola conexión hace SET ROLE. Control positivo: lo que necesitan los
// armadores y el registro funciona así. Control negativo: lo cifrado, lo crudo, lo personal, el texto libre del plan, la
// acción y la cantidad de las reglas, y cualquier escritura fuera de un INSERT en resumen_ia dan 42501. inv_app, con su
// único permiso sobre resumen_ia (el SELECT del bucle de todas las tablas), lee y no escribe. La prueba con los roles
// reales es tests/unit/produccion/roles-base.test.ts (solo CI). Datos inventados: especies propias de la corrida,
// valores no redondos y fechas de 2027 (el calendario de la BVC sembrado).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leerFondosHistoria, leerHistoria } from "@/app/proyecciones/datos";
import { ultimaConciliacion } from "@/conciliacion/leer";
import { CATALOGO as SERIES } from "@/datos-oficiales/catalogo";
import { leerDecretos, leerProximos } from "@/datos-oficiales/decretos/leer";
import { estadoSerie, serieEnRango } from "@/datos-oficiales/series/leer";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { gastoDelMes, registrarResumen, ultimoPublicado, yaPublicado } from "@/ia/registro/registro";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { calendarioBvc, leerReglas, leerVersiones, ultimosCierres } from "@/plan/lectura";
import { leerEntradas } from "@/proyecciones/leer";
import { obtenerResumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { ENTRADAS_FICTICIAS } from "../../unit/ia/apoyo/hechos.ficticio";

const db = new PrismaClient();
const ROL = "pg_signal_backend";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const ESPECIE = `PI${corrida}`;
const HOY = new Date("2027-09-14T00:00:00.000Z");
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const sql = readFileSync(fileURLToPath(new URL("../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");

/** Los GRANT de inv_ia en privilegios.sql, tal cual, para dárselos al rol de la prueba. */
const grantsIa = [...sql.matchAll(/GRANT\s+([A-Z]+\s*(?:\([^)]*\))?)\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_ia\s*;/g)].map((m) => ({ privilegio: m[1]!, tabla: m[2]! }));
const TABLAS_IA = [...new Set(grantsIa.map((g) => g.tabla))];

let restringida: PrismaClient;
let instrumentoId = "";
/** Sin sembrar el plan (la vigencia de una versión no retrocede y la base es compartida): los permisos se revisan al planear la consulta, con o sin filas. */
const planVersionId = `version-ficticia-${corrida}`;
const quien = async () => (await restringida.$queryRaw<{ u: string }[]>`SELECT current_user::text AS u`)[0]?.u;
const negado = async (sentencia: string) => {
  await expect(restringida.$executeRawUnsafe(sentencia), sentencia).rejects.toThrow(/42501|permission denied/);
};

async function sembrar(): Promise<void> {
  const dueno = await db.usuario.create({ data: { email: `dueno-ia-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } });
  const imp = async (nombre: string, t: string) => {
    const r = await importarArchivoTrii(db, { nombreArchivo: nombre, contenido: new TextEncoder().encode(t), usuarioId: dueno.id });
    if (r.estado !== "CARGADO") throw new Error(`siembra ${nombre}: ${r.estado}`);
  };
  await imp("o-ia.ficticio.csv", ORD + `"9 feb 2027, 10:00 a. m.",${ESPECIE},Compra,Aprobado,137,0,23.17,3174.29,7.13,3181.42\n"7 jun 2027, 10:00 a. m.",${ESPECIE},Venta,Aprobado,41,0,29.03,1190.23,7.13,1183.1\n`);
  await imp("d-ia.ficticio.csv", `Fecha y hora,Ticker,Estado,Valor total\n2027-04-19,${ESPECIE},,61.37\n`);
  await construirLotes(db);
  instrumentoId = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: ESPECIE } })).id;
  await db.precioCierre.create({ data: { instrumentoId, fecha: new Date("2027-09-13T00:00:00.000Z"), precio: "27.41", fuente: "yahoo", estado: "NO_VERIFICADO" } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  expect(grantsIa.length).toBeGreaterThan(5);
  await sembrar();
  // Lo que crear-roles-prod.sh le da a inv_ia (USAGE del esquema) y, encima, los GRANT de privilegios.sql.
  await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROL}`);
  for (const g of grantsIa) await db.$executeRawUnsafe(`GRANT ${g.privilegio} ON TABLE public.${g.tabla} TO ${ROL}`);
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("connection_limit", "1");
  restringida = new PrismaClient({ datasourceUrl: url.toString() });
  await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
}, 60_000);

afterAll(async () => {
  await restringida?.$disconnect();
  // REVOKE de tabla quita también los de columna.
  for (const t of TABLAS_IA) await db.$executeRawUnsafe(`REVOKE ALL ON TABLE public.${t} FROM ${ROL}`);
  await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${ROL}`);
  await db.$disconnect();
});

describe("con los privilegios de inv_ia: control positivo", () => {
  it("el cliente es de verdad el rol restringido", async () => {
    expect(await quien()).toBe(ROL);
  });

  it("DIARIO: el tablero, la evolución, la última conciliación y las series oficiales", async () => {
    const resumen = await obtenerResumen(restringida);
    expect(resumen.tablero.filas.some((f) => f.nemotecnico === ESPECIE)).toBe(true);
    await expect(obtenerEvolucion(restringida, resumen)).resolves.toBeDefined();
    await expect(ultimaConciliacion(restringida)).resolves.not.toBeUndefined();
    for (const serie of SERIES) {
      await expect(estadoSerie(restringida, serie.codigo, HOY), serie.codigo).resolves.toBeDefined();
      await expect(serieEnRango(restringida, serie.codigo, new Date("2027-06-01T00:00:00Z"), HOY), serie.codigo).resolves.toBeDefined();
    }
    expect(await quien()).toBe(ROL);
  });

  it("REGLAS: los cierres, el calendario, los decretos y la versión vigente con sus reglas SIN acción, cantidad ni detalle", async () => {
    const cierres = await ultimosCierres(restringida, [instrumentoId]);
    expect(cierres.get(instrumentoId)).toBeDefined();
    await expect(calendarioBvc(restringida)).resolves.toBeDefined();
    await expect(leerProximos(restringida, HOY)).resolves.toBeDefined();
    await expect(leerDecretos(restringida, HOY, new Date("2027-01-04T00:00:00Z"))).resolves.toBeDefined();
    await expect(restringida.planVersion.findMany({ select: { id: true, version: true, vigenteDesde: true, creadaEn: true }, orderBy: { version: "desc" } })).resolves.toBeDefined();
    const reglas = await restringida.reglaPlan.findMany({ where: { planVersionId }, select: { id: true, planVersionId: true, instrumentoId: true, condicion: true, nivel: true, plazoHasta: true } });
    expect(reglas).toEqual([]);
  });

  it("ESCENARIOS: las entradas de las proyecciones y la historia de las acciones y del fondo", async () => {
    await expect(leerEntradas(restringida, HOY)).resolves.toBeDefined();
    await expect(leerFondosHistoria(restringida, HOY)).resolves.toBeDefined();
    await expect(leerHistoria(restringida, HOY)).resolves.toBeDefined();
    expect(await quien()).toBe(ROL);
  });

  it("el registro: registrar, no repetir, leer el último publicado y sumar el gasto", async () => {
    const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.ESCENARIOS(), avisos: [`PRIVILEGIOS_IA_${corrida}`] });
    const prompt = { version: "resumen-escenarios-v1", hash: sha256Hex(`prompt ficticio de privilegios ${corrida}`) };
    const exito = { ok: true, puerta: "nube", salidaCruda: "{}", modelo: "modelo-ficticio", modeloDigest: "digest-ficticio-4613", latenciaMs: 1913, tokensEntrada: 2389, tokensSalida: 173 } as const;
    const clave = { tipo: "ESCENARIOS", fechaNegocio: paquete.hoy, hechosHash: paquete.hash, promptHash: prompt.hash, modeloDigest: exito.modeloDigest } as const;
    expect(await yaPublicado(restringida, clave)).toBe(false);
    const r = await registrarResumen(restringida, { paquete, prompt, opciones: { temperature: 0 }, validadorVersion: "validador-v1", estado: "PUBLICADO", exito, texto: "Resumen ficticio de escenarios." });
    expect(r.generadoEn).toBeInstanceOf(Date);
    expect(await yaPublicado(restringida, clave)).toBe(true);
    expect((await ultimoPublicado(restringida, "ESCENARIOS", paquete.hoy))?.id).toBe(r.id);
    const gasto = await gastoDelMes(restringida, "nube", new Date(r.generadoEn.getTime() - 1), new Date(r.generadoEn.getTime() + 1));
    expect(gasto.tokensEntrada).toBeGreaterThanOrEqual(2389);
    expect(await quien()).toBe(ROL);
  });
});

describe("con los privilegios de inv_ia: control negativo", () => {
  it("los lectores de la página del plan leen el motivo, la acción, la cantidad y el detalle: dan 42501 (el servicio necesita los suyos)", async () => {
    await expect(leerVersiones(restringida)).rejects.toThrow(/42501|permission denied/);
    await expect(leerReglas(restringida, planVersionId)).rejects.toThrow(/42501|permission denied/);
  });

  it.each([
    'SELECT "crudo" FROM fila_fuente LIMIT 1',
    'SELECT "encargo" FROM certificacion_fondo LIMIT 1',
    'SELECT "email" FROM usuario LIMIT 1',
    'SELECT "claveHash" FROM usuario LIMIT 1',
    'SELECT "precioValoracion" FROM certificacion_posicion LIMIT 1',
    'SELECT "detalle" FROM regla_plan LIMIT 1',
    'SELECT "accion" FROM regla_plan LIMIT 1',
    'SELECT "cantidad" FROM regla_plan LIMIT 1',
    'SELECT "motivo" FROM plan_version LIMIT 1',
    'SELECT "motivo" FROM decision LIMIT 1',
    'SELECT "nombreArchivo" FROM carga_archivo LIMIT 1',
    "SELECT * FROM instrumento LIMIT 1",
    "SELECT * FROM regla_plan LIMIT 1",
    "SELECT count(*) FROM movimiento_caja",
    "SELECT count(*) FROM simbolo_precio",
  ])("no lee: %s", async (sentencia) => {
    await negado(sentencia);
  });

  it.each([
    `UPDATE resumen_ia SET texto = 'x' WHERE false`,
    "DELETE FROM resumen_ia WHERE false",
    "TRUNCATE resumen_ia",
    `INSERT INTO resumen_ia ("generadoEn") VALUES (now())`,
    "INSERT INTO orden (id) VALUES ('x')",
    "UPDATE precio_cierre SET \"reemplazadoEn\" = now() WHERE false",
    "SELECT id FROM resumen_ia WHERE false FOR UPDATE",
    "CREATE TABLE ia_intrusa (x int)",
  ])("no escribe: %s", async (sentencia) => {
    await negado(sentencia);
  });
});

describe("inv_app y resumen_ia: solo lee", () => {
  // El único permiso de inv_app sobre resumen_ia es el SELECT del bucle de todas las tablas (privilegios.test.ts y
  // privilegios-ia.test.ts lo fijan en el texto); aquí se le da eso y nada más a otro rol predefinido sin privilegios.
  const APP = "pg_checkpoint";
  let app: PrismaClient;

  beforeAll(async () => {
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${APP}`);
    await db.$executeRawUnsafe(`GRANT SELECT ON TABLE public.resumen_ia TO ${APP}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    app = new PrismaClient({ datasourceUrl: url.toString() });
    await app.$executeRawUnsafe(`SET ROLE ${APP}`);
  });

  afterAll(async () => {
    await app?.$disconnect();
    await db.$executeRawUnsafe(`REVOKE ALL ON TABLE public.resumen_ia FROM ${APP}`);
    await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${APP}`);
  });

  it("lee el último publicado (control positivo) y no inserta, ni edita, ni borra", async () => {
    await expect(ultimoPublicado(app, "ESCENARIOS", ENTRADAS_FICTICIAS.ESCENARIOS().hoy)).resolves.not.toBeUndefined();
    for (const sentencia of ["INSERT INTO resumen_ia (id) VALUES ('x')", "UPDATE resumen_ia SET texto = 'x' WHERE false", "DELETE FROM resumen_ia WHERE false"]) {
      await expect(app.$executeRawUnsafe(sentencia), sentencia).rejects.toThrow(/42501|permission denied/);
    }
  });
});
