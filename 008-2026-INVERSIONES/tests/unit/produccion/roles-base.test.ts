// Roles de producción contra una PostgreSQL 16 real: crear-roles-prod.sql + migraciones como inv_dueno +
// guardián del esquema + privilegios.sql, y luego inv_app intenta lo que nunca debe poder hacer. Después, inv_precios
// (servicio de precios): privilegios.sql pasa sin el rol (mientras Jelk no corra crear-roles-prod.sh), el rol se crea
// con el SQL de crear-roles-prod.sh (NOLOGIN y sin clave hasta su secreto), privilegios.sql se reaplica,
// precios:actualizar y actualizar-fondo corren con él (buscadores simulados) y lo prohibido falla. Todo en este
// archivo: los roles son globales del clúster.
//
// Corre SOLO en GitHub Actions (GITHUB_ACTIONS=true), contra la base efímera del job `app-008`
// (DATABASE_URL_TEST, superusuario, nombre terminado en _test). Nunca en el Mac: los roles son globales
// del clúster y el clúster local tiene la base de trabajo. Si los roles ya existen, se niega (no son suyos).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarFondo } from "@/fondo/actualizar";
import type { BuscarSfc } from "@/fondo/sfc";
import { corregirDecision, registrarDecision, registrarDecisionConOrden } from "@/plan/decisiones";
import { enlazarOrden } from "@/plan/enlaces";
import { crearVersionPlan } from "@/plan/versiones";
import { actualizarPrecios } from "@/precios/actualizar";
import { leerCsvCierres } from "@/precios/csv-cierres";
import { guardarCierresDeEspecies } from "@/precios/guardar";
import { importarPrecios, type LecturaValida } from "@/precios/importar";
import type { Buscar, Cierre } from "@/precios/yahoo";
import { ACEPTADOS, RECHAZOS, VERIFICACION_FALSA, idsDe, insertarCierre, sembrar as sembrarIntegridad, type Ids } from "../../ayudas/integridad-precios";
import { carpetaTemporal, funcion, ruta008 } from "./falsos";
import { filasPermisos, PERMISOS_PRECIOS } from "./permisos-precios";
import { ultimaConciliacion } from "@/conciliacion/leer";
import { leerProximos } from "@/datos-oficiales/decretos/leer";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { gastoDelMes, registrarResumen, ultimoPublicado, yaPublicado } from "@/ia/registro/registro";
import { leerReglas, leerVersiones, ultimosCierres } from "@/plan/lectura";
import { leerEntradas } from "@/proyecciones/leer";
import { obtenerResumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { ENTRADAS_FICTICIAS } from "../ia/apoyo/hechos.ficticio";
import { filasPermisos as filasIa, PERMISOS_IA } from "../ia/registro/permisos-ia";

const URL_BASE = process.env.DATABASE_URL_TEST ?? "";
const EN_CI = process.env.GITHUB_ACTIONS === "true";
const BASE_PRUEBA = "inv_roles_test";
const CLAVE_DUENO = "d".repeat(48);
const CLAVE_APP = "e".repeat(48);
const CLAVE_PRECIOS = "f".repeat(48);
const CLAVE_IA = "7c".repeat(24);
const ROLES = "('inv_dueno','inv_app','inv_precios','inv_ia')";

const conBase = (usuario: string, clave: string | null, base: string) => {
  const u = new URL(URL_BASE);
  if (clave !== null) {
    u.username = usuario;
    u.password = clave;
  }
  u.pathname = `/${base}`;
  u.search = "?schema=public";
  return u.toString();
};
const superusuario = (base: string) => conBase("", null, base);

function prisma(args: string[], url: string) {
  const r = spawnSync(ruta008("node_modules/.bin/prisma"), args, { cwd: ruta008("."), env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" });
  return r;
}
const ejecutarSql = (archivo: string, url: string) => prisma(["db", "execute", "--url", url, "--file", archivo], url);

describe.skipIf(!EN_CI)("roles de producción en PostgreSQL real (solo CI)", () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  /** privilegios.sql corrido como en el despliegue de hoy: sin el rol inv_precios. */
  let privilegiosSinPrecios: ReturnType<typeof ejecutarSql> | undefined;

  beforeAll(async () => {
    const nombre = decodeURIComponent(new URL(URL_BASE).pathname.slice(1));
    if (!nombre.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
    admin = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
    const existentes = await admin.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM pg_roles WHERE rolname IN ${ROLES}`);
    if (Number(existentes[0]!.n) !== 0) throw new Error("los roles inv_dueno/inv_app/inv_precios ya existen en este clúster: no se tocan");
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${BASE_PRUEBA}`);

    const roles = ejecutarSql(ruta008("scripts/crear-roles-prod.sql"), superusuario(BASE_PRUEBA));
    if (roles.status !== 0) throw new Error(`crear-roles-prod.sql: ${roles.stderr}`);
    const enPrueba = new PrismaClient({ datasources: { db: { url: superusuario(BASE_PRUEBA) } } });
    await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_dueno PASSWORD '${CLAVE_DUENO}'`);
    await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_app PASSWORD '${CLAVE_APP}'`);
    await enPrueba.$disconnect();

    const dueno = conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA);
    for (const [nombrePaso, r] of [
      ["migrate deploy", prisma(["migrate", "deploy"], dueno)],
      ["verificar-esquema.sql", ejecutarSql(ruta008("scripts/verificar-esquema.sql"), dueno)],
    ] as const) {
      if (r.status !== 0) throw new Error(`${nombrePaso}: ${r.stderr}`);
    }
    privilegiosSinPrecios = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), dueno);
    if (privilegiosSinPrecios.status !== 0) throw new Error(`privilegios.sql sin inv_precios: ${privilegiosSinPrecios.stderr}`);
    app = new PrismaClient({ datasources: { db: { url: conBase("inv_app", CLAVE_APP, BASE_PRUEBA) } } });
  }, 120_000);

  afterAll(async () => {
    await app?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA} WITH (FORCE)`);
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_ia");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_precios");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_app");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_dueno");
      await admin.$disconnect();
    }
  }, 60_000);

  const negado = async (sql: string) => {
    await expect(app.$executeRawUnsafe(sql)).rejects.toThrow(/42501|permission denied|must be owner/);
  };

  it("inv_app lee las tablas y compara citext (email) aunque PUBLIC no ejecute las funciones de inv_dueno", async () => {
    await expect(app.$queryRawUnsafe("SELECT count(*) FROM orden")).resolves.toBeDefined();
    await expect(app.$queryRawUnsafe("SELECT count(*) FROM usuario WHERE email = 'ficticio@ejemplo.invalid'")).resolves.toBeDefined();
  });

  it("inv_app hace exactamente las escrituras del login (y los disparadores corren con sus funciones)", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe(`INSERT INTO usuario (id, email, rol) VALUES ('u-roles', 'roles@ejemplo.invalid', 'DUENO')`);
    await dueno.$executeRawUnsafe(
      `INSERT INTO token_acceso (id, "usuarioId", "tokenHash", proposito, "venceEn") VALUES ('t-roles', 'u-roles', '${"a".repeat(64)}', 'INICIAL', now() + interval '10 minutes')`,
    );
    await dueno.$disconnect();
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "sesionVersion" = "sesionVersion" + 1, "bloqueadoHasta" = NULL WHERE id = 'u-roles'`)).resolves.toBe(1);
    await expect(app.$executeRawUnsafe(`INSERT INTO intento_ingreso (id, "usuarioId", resultado) VALUES ('i-roles', 'u-roles', 'EXITO')`)).resolves.toBe(1);
    await expect(app.$queryRawUnsafe(`SELECT id FROM token_acceso WHERE id = 't-roles' FOR UPDATE`)).resolves.toBeDefined();
    await expect(app.$executeRawUnsafe(`UPDATE token_acceso SET "usadoEn" = now() WHERE id = 't-roles'`)).resolves.toBe(1);
    // Segundo uso: lo frena el disparador (no un permiso).
    await expect(app.$executeRawUnsafe(`UPDATE token_acceso SET "usadoEn" = now() WHERE id = 't-roles'`)).rejects.toThrow(/un solo uso/);
  });

  it("inv_app tiene UPDATE de sesionVersion pero no la puede bajar: no revive JWT revocados (D2, disparador)", async () => {
    // Usuario propio (no depende del caso anterior), con la versión ya subida una vez.
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe(`INSERT INTO usuario (id, email, rol, "sesionVersion") VALUES ('u-roles-d2', 'roles-d2@ejemplo.invalid', 'DUENO', 2)`);
    await dueno.$disconnect();
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "sesionVersion" = "sesionVersion" - 1 WHERE id = 'u-roles-d2'`)).rejects.toThrow(/la versión de sesión no baja/);
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "sesionVersion" = 2147483647 WHERE id = 'u-roles-d2'`)).rejects.toThrow(/sube de a uno/);
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "claveHash" = '$2b$12$${"c".repeat(53)}' WHERE id = 'u-roles-d2'`)).resolves.toBe(1);
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "claveHash" = NULL WHERE id = 'u-roles-d2'`)).rejects.toThrow(/cambiar o quitar la clave/);
  });

  for (const sql of [
    'INSERT INTO orden ("id") VALUES (\'x\')',
    "DELETE FROM usuario WHERE false",
    "TRUNCATE orden",
    "ALTER TABLE orden DISABLE TRIGGER orden_solo_insercion",
    "ALTER TABLE orden ADD COLUMN x int",
    "DROP TABLE orden",
    "CREATE TABLE intruso (id int)",
    "SELECT * FROM _prisma_migrations",
    "UPDATE precio_cierre SET precio = precio WHERE false",
    "UPDATE usuario SET activo = activo WHERE false",
    "UPDATE usuario SET rol = rol WHERE false",
    "UPDATE usuario SET email = email WHERE false",
    "UPDATE token_acceso SET \"venceEn\" = \"venceEn\" WHERE false",
    "UPDATE intento_ingreso SET resultado = resultado WHERE false",
    "DELETE FROM token_acceso WHERE false",
    // El plan y el diario (área de edición): solo INSERT; nada se edita ni se borra, ni se bloquea con FOR UPDATE.
    "UPDATE plan_version SET motivo = motivo WHERE false",
    "UPDATE regla_plan SET detalle = detalle WHERE false",
    "UPDATE decision SET motivo = motivo WHERE false",
    "UPDATE enlace_decision_orden SET motivo = motivo WHERE false",
    "DELETE FROM plan_version WHERE false",
    "DELETE FROM decision WHERE false",
    "DELETE FROM enlace_decision_orden WHERE false",
    "TRUNCATE decision",
    "SELECT id FROM decision WHERE false FOR UPDATE",
    // Los instantes los pone la base (migración *_instantes_base): inv_app no los puede nombrar, ni sin filas (el
    // permiso de columna se revisa al empezar).
    `INSERT INTO plan_version (id, "creadaEn") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`,
    `INSERT INTO decision (id, "registradaEn") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`,
    `INSERT INTO enlace_decision_orden (id, "creadoEn") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`,
    // Sin objetos temporales: las funciones de los instantes no fijan search_path (todo va calificado con pg_catalog).
    "CREATE TEMP TABLE intruso (id int)",
  ]) {
    it(`inv_app NO puede: ${sql}`, async () => {
      await negado(sql);
    });
  }

  it("inv_app NO puede saltarse la solo inserción con SET LOCAL inv.reversion", async () => {
    await expect(
      app.$transaction([app.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'"), app.$executeRawUnsafe("DELETE FROM orden WHERE false")]),
    ).rejects.toThrow(/42501|permission denied/);
  });

  // Área de edición del plan (fase B, PR-B): la web corre como inv_app y escribe el plan y el diario con las funciones
  // REALES del dominio, que solo necesitan INSERT (el candado de la decisión es consultivo, no FOR UPDATE).
  it("inv_app crea versiones, registra, enlaza y corrige decisiones con el dominio real (solo INSERT)", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    const hoy = new Date("2026-06-30T00:00:00.000Z");
    const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
    try {
      const u = await dueno.usuario.create({ data: { email: "roles-plan@ejemplo.invalid", rol: "DUENO" } });
      const inst = await dueno.instrumento.create({ data: { tipo: "ACCION", nemotecnico: "FICTROL", nombre: "Acción ficticia de roles" } });
      const carga = await dueno.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-roles.ficticio.csv", sha256: "7".repeat(64), estado: "CARGADO", cargadoPorId: u.id } });
      const venta = async (k: number) => {
        const fila = await dueno.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: `roles-plan-${k}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: k, crudo: { ficticio: true } } });
        return dueno.orden.create({
          data: {
            filaFuenteId: fila.id, ejecutadaEn: new Date("2025-03-05T20:00:00.000Z"), fechaOperacion: dia("2025-03-05"), fechaLiquidacion: dia("2025-03-07"), instrumentoId: inst.id,
            lado: "VENTA", estado: "APROBADO", cantidadCompletada: 37n, precioUnitario: new Prisma.Decimal("12.37"), totalInvertido: new Prisma.Decimal("457.69"),
            comision: new Prisma.Decimal("4.61"), totalEstimado: new Prisma.Decimal("453.08"),
          },
        });
      };
      const [o1, o2] = [await venta(1), await venta(2)];
      const v = await crearVersionPlan(app, { vigenteDesde: dia("2025-03-03"), motivo: "Plan ficticio de roles", autorId: u.id, reglas: [{ instrumentoId: inst.id, condicion: "NINGUNA", nivel: null, accion: "VENDER", cantidad: null, plazoHasta: null, detalle: "Vender (ficticia)" }] }, { hoy, ultimaEsperada: 0 });
      const datos = { fechaDecision: dia("2025-03-04"), instrumentoId: inst.id, accion: "VENDER" as const, reglaId: v.reglaIds[0]!, motivo: "Vender (ficticio)", autorId: u.id };
      const d = await registrarDecision(app, datos, { hoy });
      await enlazarOrden(app, { ordenId: o1.id, decisionId: d.id, autorId: u.id });
      const c = await corregirDecision(app, d.id, { ...datos, motivo: "Vender (ficticio, corregida)" }, { hoy });
      expect(c.enlacesMovidos).toBe(1);
      const conOrden = await registrarDecisionConOrden(app, { ...datos, motivo: "Con su orden (ficticio)" }, o2.id, { hoy });
      expect(await dueno.enlaceDecisionOrden.count({ where: { decisionId: { in: [c.id, conOrden.id] }, reemplazadoPor: { is: null } } })).toBe(2);
    } finally {
      await dueno.$disconnect();
    }
  });

  // Los instantes del plan y del diario los pone la base (migración *_instantes_base), con inv_app real.
  describe("inv_app no fija los instantes del plan ni del diario", () => {
    const ANTEDATADO = "TIMESTAMPTZ '2019-02-11 10:37:00+00'";
    let dueno: PrismaClient;
    let usuario = "";
    let instrumento = "";
    /** Una orden de venta por caso (una sola raíz por orden). */
    let ordenes: string[] = [];
    const reaplicarPrivilegios = () => {
      const r = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
      expect(r.status, r.stderr).toBe(0);
    };
    const reloj = async (db: PrismaClient) => (await db.$queryRaw<{ t: Date }[]>`SELECT clock_timestamp() AS t`)[0]!.t;
    /** Los INSERT de las tres tablas con un instante (`k` distingue las filas de cada caso). */
    const inserts = (k: string, version: number, orden: string, instante: string | null): string[] => {
      const col = (c: string) => (instante === null ? "" : `, "${c}"`);
      const val = instante === null ? "" : `, ${instante}`;
      return [
        `INSERT INTO plan_version (id, version, "vigenteDesde", motivo, "aprobadaPorId"${col("creadaEn")}) VALUES ('rb-v-${k}', ${version}, DATE '2019-02-04', 'Versión ficticia', '${usuario}'${val})`,
        `INSERT INTO decision (id, "planVersionId", "instrumentoId", accion, motivo, "decididaPorId", "fechaDecision"${col("registradaEn")}) VALUES ('rb-d-${k}', 'rb-v-${k}', '${instrumento}', 'VENDER', 'Decisión ficticia', '${usuario}', DATE '2019-02-12'${val})`,
        `INSERT INTO enlace_decision_orden (id, "ordenId", "decisionId", "creadoPorId"${col("creadoEn")}) VALUES ('rb-e-${k}', '${orden}', 'rb-d-${k}', '${usuario}'${val})`,
      ];
    };
    const instantes = async (k: string): Promise<Date[]> => {
      const f = await dueno.$queryRawUnsafe<Array<{ v: Date; d: Date; e: Date }>>(
        `SELECT v."creadaEn" AS v, d."registradaEn" AS d, e."creadoEn" AS e FROM plan_version v, decision d, enlace_decision_orden e
          WHERE v.id = 'rb-v-${k}' AND d.id = 'rb-d-${k}' AND e.id = 'rb-e-${k}'`,
      );
      expect(f).toHaveLength(1);
      return [f[0]!.v, f[0]!.d, f[0]!.e];
    };

    beforeAll(async () => {
      dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
      usuario = (await dueno.usuario.create({ data: { email: "roles-instantes@ejemplo.invalid", rol: "DUENO" } })).id;
      instrumento = (await dueno.instrumento.create({ data: { tipo: "ACCION", nemotecnico: "FICTINS", nombre: "Acción ficticia de los instantes" } })).id;
      const carga = await dueno.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-instantes.ficticio.csv", sha256: "3".repeat(64), estado: "CARGADO", cargadoPorId: usuario } });
      const ventas: string[] = [];
      for (const k of [1, 2, 3]) {
        const fila = await dueno.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: `roles-instantes-${k}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: k, crudo: { ficticio: true } } });
        const o = await dueno.orden.create({
          data: {
            filaFuenteId: fila.id, ejecutadaEn: new Date("2019-02-13T19:41:00.000Z"), fechaOperacion: new Date("2019-02-13T00:00:00.000Z"), fechaLiquidacion: new Date("2019-02-15T00:00:00.000Z"),
            instrumentoId: instrumento, lado: "VENTA", estado: "APROBADO", cantidadCompletada: 37n, precioUnitario: new Prisma.Decimal("12.37"), totalInvertido: new Prisma.Decimal("457.69"),
            comision: new Prisma.Decimal("4.61"), totalEstimado: new Prisma.Decimal("453.08"),
          },
        });
        ventas.push(o.id);
      }
      ordenes = ventas;
    });

    afterAll(async () => {
      await dueno?.$disconnect();
    });

    it("en una transacción sostenida, la web (Prisma, sin el instante) recibe la hora de la fila, no la del inicio", async () => {
      const r = await app.$transaction(async (tx) => {
        const inicio = (await tx.$queryRaw<{ t: Date }[]>`SELECT now() AS t`)[0]!.t;
        await tx.$executeRawUnsafe("SELECT pg_sleep(0.25)");
        const v = await tx.planVersion.create({ data: { version: 4613, vigenteDesde: new Date("2019-02-04T00:00:00.000Z"), motivo: "Versión ficticia sostenida", aprobadaPorId: usuario } });
        return { inicio, creadaEn: v.creadaEn };
      });
      expect(r.creadaEn.getTime() - r.inicio.getTime()).toBeGreaterThanOrEqual(250);
    });

    it("con el permiso de columna dado por error, el disparador ignora el instante antedatado; privilegios.sql lo quita", async () => {
      await dueno.$executeRawUnsafe('GRANT INSERT ("creadaEn") ON TABLE plan_version TO inv_app');
      await dueno.$executeRawUnsafe('GRANT INSERT ("registradaEn") ON TABLE decision TO inv_app');
      await dueno.$executeRawUnsafe('GRANT INSERT ("creadoEn") ON TABLE enlace_decision_orden TO inv_app');
      const antes = await reloj(dueno);
      try {
        for (const s of inserts("error", 4617, ordenes[1]!, ANTEDATADO)) await expect(app.$executeRawUnsafe(s), s).resolves.toBe(1);
      } finally {
        reaplicarPrivilegios();
      }
      const despues = await reloj(dueno);
      for (const t of await instantes("error")) {
        expect(t.getTime()).toBeGreaterThanOrEqual(antes.getTime());
        expect(t.getTime()).toBeLessThanOrEqual(despues.getTime());
      }
      await negado(`INSERT INTO plan_version (id, "creadaEn") SELECT 'x', ${ANTEDATADO} WHERE false`);
    });

    it("el dueño conserva el instante que manda (restauración de solo datos): la exención es solo suya", async () => {
      for (const s of inserts("dueno", 4619, ordenes[2]!, ANTEDATADO)) await expect(dueno.$executeRawUnsafe(s), s).resolves.toBe(1);
      for (const t of await instantes("dueno")) expect(t.toISOString()).toBe("2019-02-11T10:37:00.000Z");
    });
  });

  describe("inv_precios: el rol del servicio de precios", () => {
    const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
    /** Barra de Yahoo a las 09:30 de Colombia del día dado. */
    const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;
    // Lunes 17, martes 18 y miércoles 19 de junio de 2024 (calendario sembrado por las migraciones). Todo inventado.
    const DIAS = ["2024-06-17", "2024-06-18", "2024-06-19"] as const;
    const desde = utc(DIAS[0]);
    const hasta = utc(DIAS[2]);
    const ahora = new Date("2024-06-20T23:00:00Z");
    const SIMBOLO = "FICTPRA.CL";
    const CODIGO_FIC = "9000001";
    const urlsYahoo: string[] = [];
    const yahoo = (closes: readonly number[], volumenes: readonly number[]): Buscar => async (url) => {
      urlsYahoo.push(url);
      return new Response(JSON.stringify({ chart: { result: [{ meta: { currency: "COP" }, timestamp: DIAS.map(ts), indicators: { quote: [{ close: closes, volume: volumenes }] } }] } }));
    };
    const sfc = (valores: readonly string[]): BuscarSfc => async () =>
      new Response(JSON.stringify(DIAS.map((d, i) => ({
        fecha_corte: `${d}T00:00:00.000`, codigo_negocio: CODIGO_FIC, tipo_participacion: "901", valor_unidad_operaciones: valores[i], valor_fondo_cierre_dia_t: "500000000",
      }))));

    let precios: PrismaClient;
    let dueno: PrismaClient;
    let conLote = "";
    let sinLote = "";
    let fondo = "";
    const creaciones: Array<ReturnType<typeof ejecutarSql>> = [];
    let antesDelMigrador: unknown = null;
    let sinSecreto: Array<Record<string, unknown>> = [];
    let entrarSinSecreto = "";
    const urlPrecios = () => `${conBase("inv_precios", CLAVE_PRECIOS, BASE_PRUEBA)}&connection_limit=2`;
    /** Abre una conexión nueva como inv_precios: «entró» o el error (sin la clave). */
    const entrarComoPrecios = async (): Promise<string> => {
      const intento = new PrismaClient({ datasources: { db: { url: urlPrecios() } } });
      try {
        await intento.$queryRawUnsafe("SELECT 1");
        return "entró";
      } catch (e) {
        return String(e).replaceAll(CLAVE_PRECIOS, "<clave>");
      } finally {
        await intento.$disconnect();
      }
    };
    const negado = async (sql: string) => {
      await expect(precios.$executeRawUnsafe(sql)).rejects.toThrow(/42501|permission denied|must be owner/);
    };

    /** Lo que siembra el dueño (como en producción): una acción con lote, certificación y símbolo; otra sin lote; un FIC. */
    async function sembrar(): Promise<void> {
      const cero = new Prisma.Decimal(0);
      const usuario = await dueno.usuario.create({ data: { email: "precios-roles@ejemplo.invalid", rol: "DUENO" } });
      const carga = await dueno.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes.ficticio.csv", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: usuario.id } });
      conLote = (await dueno.instrumento.create({ data: { tipo: "ACCION", nemotecnico: "FICTPRA", nombre: "Ficticia A" } })).id;
      sinLote = (await dueno.instrumento.create({ data: { tipo: "ACCION", nemotecnico: "FICTPRB", nombre: "Ficticia B" } })).id;
      const fila = await dueno.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: "roles-precios-1", ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: { ficticio: true } } });
      const orden = await dueno.orden.create({
        data: {
          filaFuenteId: fila.id, ejecutadaEn: utc("2024-01-15"), fechaOperacion: utc("2024-01-15"), fechaLiquidacion: utc("2024-01-17"), instrumentoId: conLote, lado: "COMPRA", estado: "APROBADO",
          cantidadCompletada: 10n, precioUnitario: new Prisma.Decimal(100), totalInvertido: new Prisma.Decimal(1000), comision: cero, totalEstimado: new Prisma.Decimal(1000),
        },
      });
      await dueno.lote.create({
        data: { instrumentoId: conLote, origen: "COMPRA", ordenId: orden.id, fuenteCosto: "TRII_ORDEN", fechaCompra: utc("2024-01-15"), fechaLiquidacion: utc("2024-01-17"), cantidad: 10n, costoUnitario: new Prisma.Decimal(100), costoTotal: new Prisma.Decimal(1000) },
      });
      await dueno.simboloPrecio.create({ data: { instrumentoId: conLote, proveedor: "yahoo", simbolo: SIMBOLO, vigenteDesde: utc("2020-01-01") } });
      const cargaCert = await dueno.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "cert.ficticio.pdf", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: usuario.id } });
      const cert = await dueno.certificacion.create({ data: { cargaId: cargaCert.id, fechaCorte: utc(DIAS[1]), saldoEfectivo: cero } });
      await dueno.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId: conLote, cantidad: 10n, precioValoracion: new Prisma.Decimal(2010), valorMercado: new Prisma.Decimal(20100) } });
      fondo = (await dueno.instrumento.create({ data: { tipo: "FIC", codigoFic: CODIGO_FIC, nombre: "Fondo ficticio" } })).id;
      await dueno.simboloPrecio.create({ data: { instrumentoId: fondo, proveedor: "sfc:qhpu-8ixx", simbolo: "901", vigenteDesde: utc("2016-01-01") } });
    }

    beforeAll(async () => {
      // El rol, con el SQL exacto que le pasa crear-roles-prod.sh a psql (sin clave); dos veces: es idempotente.
      const sqlRol = funcion(ruta008("scripts/crear-roles-prod.sh"), "sql_rol_precios", { PATH: process.env.PATH });
      if (sqlRol.status !== 0) throw new Error(`sql_rol_precios: ${sqlRol.stderr}`);
      const archivo = path.join(carpetaTemporal("rol-precios"), "rol-precios.sql");
      writeFileSync(archivo, sqlRol.stdout);
      for (let i = 0; i < 2; i += 1) creaciones.push(ejecutarSql(archivo, superusuario(BASE_PRUEBA)));
      // Sin su secreto (como lo deja el script cuando el archivo no trae la línea): NOLOGIN y sin clave, no entra.
      sinSecreto = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
        "SELECT rolcanlogin, rolpassword IS NULL AS sin_clave FROM pg_authid WHERE rolname = 'inv_precios'",
      );
      entrarSinSecreto = await entrarComoPrecios();
      // Con su secreto: la sentencia que emite el script (LOGIN y clave juntos), con la clave inventada en el texto.
      const enPrueba = new PrismaClient({ datasources: { db: { url: superusuario(BASE_PRUEBA) } } });
      await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_precios WITH LOGIN PASSWORD '${CLAVE_PRECIOS}'`);
      await enPrueba.$disconnect();
      precios = new PrismaClient({ datasources: { db: { url: urlPrecios() } } });
      // Recién creado, antes del migrador: se conecta pero no lee nada (falla cerrada).
      antesDelMigrador = await precios.$queryRawUnsafe("SELECT id FROM instrumento LIMIT 1").then(() => "leyó", (e: unknown) => String(e));
      dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
      const r = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
      if (r.status !== 0) throw new Error(`privilegios.sql con inv_precios: ${r.stderr}`);
      await sembrar();
    }, 120_000);

    afterAll(async () => {
      await precios?.$disconnect();
      await dueno?.$disconnect();
    });

    it("privilegios.sql pasa sin el rol (el despliegue de hoy no depende de inv_precios)", () => {
      expect(privilegiosSinPrecios?.status, privilegiosSinPrecios?.stderr).toBe(0);
    });

    it("el SQL de crear-roles-prod.sh crea el rol y es idempotente; recién creado no lee nada hasta el migrador", () => {
      expect(creaciones.map((c) => c.status), creaciones.map((c) => c.stderr).join("\n")).toEqual([0, 0]);
      expect(String(antesDelMigrador)).toMatch(/42501|permission denied/);
    });

    it("sin su secreto el rol existe NOLOGIN y sin clave, y no entra (así los GRANT de un respaldo siempre lo encuentran)", () => {
      expect(sinSecreto).toEqual([{ rolcanlogin: false, sin_clave: true }]);
      expect(entrarSinSecreto).not.toBe("entró");
      expect(entrarSinSecreto).toMatch(/Authentication failed|not permitted to log in|credentials for `inv_precios` are not valid/i);
    });

    it("atributos del rol: LOGIN, NOINHERIT, sin superusuario, sin crear bases ni roles, sin replicación ni BYPASSRLS, 4 conexiones", async () => {
      const filas = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
        "SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolconnlimit FROM pg_roles WHERE rolname = 'inv_precios'",
      );
      expect(filas).toEqual([{ rolcanlogin: true, rolinherit: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolconnlimit: 4 }]);
    });

    it("topes por sesión del rol (revisión de base M3): statement_timeout 60s e idle_in_transaction_session_timeout 30s", async () => {
      const filas = await admin.$queryRawUnsafe<Array<{ ajuste: string }>>(
        "SELECT unnest(rolconfig) AS ajuste FROM pg_roles WHERE rolname = 'inv_precios' ORDER BY 1",
      );
      expect(filas.map((f) => f.ajuste)).toEqual(["idle_in_transaction_session_timeout=30s", "statement_timeout=60s"]);
    });

    it("el catálogo tiene exactamente los permisos de la lista, por columna; nada de tabla, secuencia ni por defecto", async () => {
      const columnas = await dueno.$queryRawUnsafe<Array<{ fila: string }>>(
        `SELECT c.relname || '.' || a.attname || ' ' || x.privilege_type AS fila
           FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace,
                aclexplode(a.attacl) x
          WHERE n.nspname = 'public' AND x.grantee = 'inv_precios'::regrole ORDER BY 1`,
      );
      expect(columnas.map((f) => f.fila).sort()).toEqual(filasPermisos(PERMISOS_PRECIOS));
      const deTabla = await dueno.$queryRawUnsafe<Array<{ n: bigint }>>(
        "SELECT count(*) AS n FROM pg_class c, aclexplode(c.relacl) x WHERE x.grantee = 'inv_precios'::regrole",
      );
      expect(Number(deTabla[0]!.n)).toBe(0);
      const porDefecto = await dueno.$queryRawUnsafe<Array<{ n: bigint }>>(
        "SELECT count(*) AS n FROM pg_default_acl d, aclexplode(d.defaclacl) x WHERE x.grantee = 'inv_precios'::regrole",
      );
      expect(Number(porDefecto[0]!.n)).toBe(0);
      const base = await dueno.$queryRawUnsafe<Array<Record<string, boolean>>>(
        `SELECT has_database_privilege('inv_precios', current_database(), 'CONNECT') AS conecta,
                has_database_privilege('inv_precios', current_database(), 'CREATE') AS crea,
                has_database_privilege('inv_precios', current_database(), 'TEMP') AS temporal,
                has_schema_privilege('inv_precios', 'public', 'USAGE') AS usa,
                has_schema_privilege('inv_precios', 'public', 'CREATE') AS crea_en_esquema`,
      );
      expect(base).toEqual([{ conecta: true, crea: false, temporal: false, usa: true, crea_en_esquema: false }]);
    });

    it("precios:actualizar con inv_precios: las especies con lote, cierres nuevos y verificados, sin fallas", async () => {
      const r = await actualizarPrecios(precios, { desde, hasta, buscar: yahoo([2001, 2002, 2003], [30, 10, 12]), ahora });
      expect(r).toMatchObject({ especies: 1, cierresNuevos: 3, cierresRevisados: 0, cierresRetirados: 0, verificados: 1, fallidas: [] });
      expect(urlsYahoo.length).toBe(1);
      expect(urlsYahoo[0]).toContain(encodeURIComponent(SIMBOLO));
    });

    it("precios:actualizar con inv_precios: revisa un cierre y retira el de un día sin negociación (UPDATE de \"reemplazadoEn\")", async () => {
      const r = await actualizarPrecios(precios, { desde, hasta, buscar: yahoo([2001, 2004, 2003], [30, 10, 0]), ahora });
      expect(r).toMatchObject({ especies: 1, cierresNuevos: 0, cierresRevisados: 1, cierresRetirados: 1, omitidasSinNegociacion: 1, verificados: 1, fallidas: [] });
      const vigentes = await dueno.precioCierre.findMany({ where: { instrumentoId: conLote, reemplazadoEn: null }, orderBy: { fecha: "asc" } });
      expect(vigentes.map((p) => [p.fecha.toISOString().slice(0, 10), p.precio.toString(), p.estado])).toEqual([[DIAS[0], "2001", "NO_VERIFICADO"], [DIAS[1], "2004", "VERIFICADO"]]);
      expect(await dueno.precioCierre.count({ where: { instrumentoId: conLote, reemplazadoEn: { not: null } } })).toBe(2);
      expect(await dueno.precioCierre.count({ where: { instrumentoId: sinLote } })).toBe(0);
    });

    it("actualizar-fondo con inv_precios: valores nuevos, una revisión y el último dato, sin fallas", async () => {
      const r1 = await actualizarFondo(precios, { desde, hasta, buscar: sfc(["10000", "10001", "10002"]) });
      expect(r1).toMatchObject({ fondos: 1, valoresNuevos: 3, valoresRevisados: 0, fallidos: [] });
      expect(r1.ultimos).toEqual([{ instrumentoId: fondo, ultimaFecha: hasta, atrasado: false }]);
      const r2 = await actualizarFondo(precios, { desde, hasta, buscar: sfc(["10000", "10001.5", "10002"]) });
      expect(r2).toMatchObject({ fondos: 1, valoresNuevos: 0, valoresRevisados: 1, fallidos: [] });
      expect(await dueno.valorUnidadFondo.count({ where: { fondoId: fondo, reemplazadoEn: { not: null } } })).toBe(1);
    });

    it("privilegios.sql parte de cero: lo que se le haya dado de más a inv_precios se le quita al reaplicarlo", async () => {
      await dueno.$executeRawUnsafe("GRANT SELECT ON TABLE orden TO inv_precios");
      await dueno.$executeRawUnsafe("GRANT DELETE ON TABLE precio_cierre TO inv_precios");
      await dueno.$executeRawUnsafe('GRANT SELECT (cantidad) ON TABLE lote TO inv_precios');
      await expect(precios.$queryRawUnsafe("SELECT count(*) FROM orden")).resolves.toBeDefined();
      const r = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
      expect(r.status, r.stderr).toBe(0);
      await negado("SELECT count(*) FROM orden");
      await negado("DELETE FROM precio_cierre WHERE false");
      await negado("SELECT cantidad FROM lote");
    });

    for (const sql of [
      'SELECT "cantidadCompletada", "totalInvertido" FROM orden',
      "SELECT id FROM orden",
      "SELECT email FROM usuario",
      "SELECT id FROM usuario",
      "SELECT crudo FROM fila_fuente",
      "SELECT cantidad FROM lote",
      'SELECT "costoTotal", "costoUnitario" FROM lote',
      "SELECT id FROM lote",
      'SELECT cantidad, "valorMercado" FROM certificacion_posicion',
      'SELECT "saldoEfectivo" FROM certificacion',
      "SELECT encargo, saldo, unidades FROM certificacion_fondo",
      "SELECT nombre FROM instrumento",
      "SELECT * FROM _prisma_migrations",
      "DELETE FROM precio_cierre WHERE false",
      "DELETE FROM valor_unidad_fondo WHERE false",
      "TRUNCATE precio_cierre",
      "TRUNCATE valor_unidad_fondo",
      "UPDATE precio_cierre SET precio = precio WHERE false",
      "UPDATE precio_cierre SET estado = estado WHERE false",
      'UPDATE valor_unidad_fondo SET "valorUnidad" = "valorUnidad" WHERE false',
      `INSERT INTO precio_cierre (id, "instrumentoId", fecha, precio, fuente, estado, "reemplazadoEn") VALUES ('x', 'x', '2024-06-20', 1, 'yahoo', 'NO_VERIFICADO', now())`,
      `INSERT INTO instrumento (id, tipo, nemotecnico, nombre) VALUES ('x', 'ACCION', 'FICTX', 'x')`,
      `INSERT INTO simbolo_precio (id, "instrumentoId", simbolo, "vigenteDesde") VALUES ('x', 'x', 'X.CL', '2024-01-01')`,
      "ALTER TABLE precio_cierre ADD COLUMN x int",
      "CREATE TABLE intruso (id int)",
      "CREATE TEMP TABLE intruso (id int)",
      "SET ROLE inv_app",
    ]) {
      it(`inv_precios NO puede: ${sql}`, async () => {
        await negado(sql);
      });
    }

    // Disparadores de integridad (migración *_precios_integridad) con el rol REAL: los mismos casos que corre la
    // integración local como pg_write_all_data (tests/ayudas/integridad-precios.ts), más lo que solo se ve aquí: los
    // privilegios por columna de verdad, inv_app con un permiso dado por error y el camino único (guardar.ts) en los
    // bordes del 1 %, con re-verificación en las dos direcciones. Escenario propio (especie y fondo inactivos).
    describe("integridad de los precios con inv_precios real (disparadores)", () => {
      let ids: Ids;
      const reaplicarPrivilegios = () => {
        const r = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
        expect(r.status, r.stderr).toBe(0);
      };
      const comoPrecios = (sql: readonly string[]) =>
        sql.length === 1 ? precios.$executeRawUnsafe(sql[0]!) : precios.$transaction(sql.map((x) => precios.$executeRawUnsafe(x)));

      beforeAll(async () => {
        ids = idsDe(randomBytes(4).toString("hex"));
        for (const x of sembrarIntegridad(ids)) await dueno.$executeRawUnsafe(x);
      });

      for (const caso of RECHAZOS.filter((c) => !c.deMas)) {
        it(`inv_precios no puede (disparador): ${caso.nombre}`, async () => {
          await expect(comoPrecios(caso.sql(ids))).rejects.toThrow(caso.error);
        });
      }

      it("con privilegios dados por error (INSERT de reemplazadoEn, UPDATE de precio, estado o valorUnidad, DELETE) igual lo frena el disparador; privilegios.sql los quita", async () => {
        const extras = [
          'GRANT INSERT ("reemplazadoEn"), UPDATE (precio, estado), DELETE ON TABLE precio_cierre TO inv_precios',
          'GRANT INSERT ("reemplazadoEn"), UPDATE ("valorUnidad"), DELETE ON TABLE valor_unidad_fondo TO inv_precios',
        ];
        for (const x of extras) await dueno.$executeRawUnsafe(x);
        try {
          for (const caso of RECHAZOS.filter((c) => c.deMas)) await expect(comoPrecios(caso.sql(ids)), caso.nombre).rejects.toThrow(caso.error);
        } finally {
          reaplicarPrivilegios();
        }
        await negado(`DELETE FROM precio_cierre WHERE id = '${ids.vigente}'`);
        await negado(`UPDATE valor_unidad_fondo SET "valorUnidad" = "valorUnidad" WHERE id = '${ids.vufVigente}'`);
      });

      for (const caso of ACEPTADOS) {
        it(`inv_precios sí puede: ${caso.nombre}`, async () => {
          await comoPrecios(caso.sql(ids));
          expect(await dueno.$queryRawUnsafe(caso.verificar(ids))).toEqual([{ ok: true }]);
        });
      }

      it("la regla vale para cualquier rol que no sea dueño: inv_app con INSERT dado por error tampoco afirma un VERIFICADO falso", async () => {
        await dueno.$executeRawUnsafe("GRANT INSERT ON TABLE precio_cierre TO inv_app");
        try {
          const falso = insertarCierre(ids, { id: "app", fecha: "DATE '2018-05-09'", precio: "3719.41", estado: "VERIFICADO" });
          await expect(app.$executeRawUnsafe(falso)).rejects.toThrow(VERIFICACION_FALSA);
        } finally {
          reaplicarPrivilegios();
        }
      });

      it("el dueño queda fuera: inv_dueno inserta un VERIFICADO sin certificación (fixtures y reparaciones)", async () => {
        const propio = insertarCierre(ids, { id: "dueno", fecha: "DATE '2018-05-11'", precio: "3719.41", estado: "VERIFICADO" });
        await expect(dueno.$executeRawUnsafe(propio)).resolves.toBe(1);
      });

      describe("el camino único (guardarCierresDeEspecies) como inv_precios, en los bordes", () => {
        // Febrero de 2022 (calendario sembrado, sin festivos). Un día por caso; la referencia, por certificación.
        const BORDES: ReadonlyArray<readonly [dia: string, valoracion: string | null, cierre: string, estado: string, referencia: string | null, desviacion: string | null]> = [
          ["2022-02-14", "4613.27", "4659.4027", "VERIFICADO", "4613.27", "1"], // 1 % exacto
          ["2022-02-15", "4613.27", "4659.402701", "NO_VERIFICADO", "4613.27", "1"], // 1 % + 1e-6: no cuadra aunque redondee a 1
          ["2022-02-16", "4613.27", "4567.1373", "VERIFICADO", "4613.27", "1"], // −1 % exacto
          ["2022-02-17", "0", "3719.41", "NO_VERIFICADO", "0", null], // valoración 0
          ["2022-02-18", "237.13", "2608.429998", "NO_VERIFICADO", "237.13", "999.999999"], // lo más que cabe
          ["2022-02-21", "237.13", "2608.43", "NO_VERIFICADO", "237.13", null], // 1000 %: no cabe
          ["2022-02-22", null, "3719.41", "NO_VERIFICADO", null, null], // sin certificación (luego llega y se va)
        ];
        const utc = (d: string) => new Date(`${d}T00:00:00Z`);
        const rango = { desde: utc("2022-02-14"), hasta: utc("2022-02-22"), ahora: new Date("2022-03-31T23:00:00Z") };
        const correr = () => {
          const cierres: Cierre[] = BORDES.map(([dia, , precio]) => ({ fecha: utc(dia), precio, volumen: 137 }));
          return guardarCierresDeEspecies(precios, [{ instrumentoId: ids.inst, traer: async () => ({ ok: true, cierres }) }], rango);
        };
        const vigente = async (dia: string) => {
          const v = await dueno.precioCierre.findFirst({ where: { instrumentoId: ids.inst, fecha: utc(dia), reemplazadoEn: null } });
          return v && [v.estado, v.precioReferencia?.toString() ?? null, v.desviacionPct?.toString() ?? null];
        };
        const certificar = async (dia: string, valoracion: string) => {
          const carga = await dueno.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "cert.ficticio.pdf", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: ids.usuario } });
          const cert = await dueno.certificacion.create({ data: { cargaId: carga.id, fechaCorte: utc(dia), saldoEfectivo: new Prisma.Decimal(0) } });
          await dueno.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId: ids.inst, cantidad: 37n, precioValoracion: new Prisma.Decimal(valoracion), valorMercado: new Prisma.Decimal(valoracion).mul(37) } });
          return cert.id;
        };

        beforeAll(async () => {
          for (const [dia, valoracion] of BORDES) if (valoracion !== null) await certificar(dia, valoracion);
        });

        it("guarda cada borde con el estado y la referencia que la base también calcula, sin fallas", async () => {
          const r = await correr();
          expect(r).toMatchObject({ especies: 1, cierresNuevos: BORDES.length, fallidas: [] });
          for (const [dia, , , estado, referencia, desviacion] of BORDES) expect(await vigente(dia), dia).toEqual([estado, referencia, desviacion]);
        });

        it("una segunda corrida igual no escribe nada (la base y el código dicen lo mismo: sin versiones en bucle)", async () => {
          expect(await correr()).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, fallidas: [] });
        });

        it("re-verifica en las dos direcciones: llega la certificación (VERIFICADO) y el dueño la revierte (NO_VERIFICADO)", async () => {
          const cert = await certificar("2022-02-22", "3724.89");
          expect(await correr()).toMatchObject({ cierresReverificados: 1, fallidas: [] });
          expect(await vigente("2022-02-22")).toEqual(["VERIFICADO", "3724.89", "0.147118"]);
          await dueno.$transaction([
            dueno.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'"),
            dueno.$executeRawUnsafe(`DELETE FROM certificacion_posicion WHERE "certificacionId" = '${cert}'`),
            dueno.$executeRawUnsafe(`DELETE FROM certificacion WHERE id = '${cert}'`),
          ]);
          expect(await correr()).toMatchObject({ cierresReverificados: 1, fallidas: [] });
          expect(await vigente("2022-02-22")).toEqual(["NO_VERIFICADO", null, null]);
        });

        it("la vía B (precios:importar) corre como inv_dueno por el mismo camino, sin fallas", async () => {
          const csv = leerCsvCierres(new TextEncoder().encode("nemotecnico,fecha,cierre,volumen\nFICTPRA,2022-02-23,3713.29,137\n"));
          expect(csv.ok).toBe(true);
          const r = await importarPrecios(dueno, csv as LecturaValida, { ahora: rango.ahora });
          expect(r.guardado).toMatchObject({ especies: 1, cierresNuevos: 1, fallidas: [] });
        });
      });
    });

    // Último del bloque: deja el rol como estaba (con LOGIN) para lo que sigue.
    it("quitar la línea del secreto y volver a correr el script lo deja NOLOGIN y sin clave: ya no entra; con la línea vuelve", async () => {
      const sinLogin = funcion(ruta008("scripts/crear-roles-prod.sh"), "sql_precios_sin_login", { PATH: process.env.PATH });
      expect(sinLogin.status, sinLogin.stderr).toBe(0);
      expect(sinLogin.stdout.trim()).toBe("ALTER ROLE inv_precios WITH NOLOGIN PASSWORD NULL;");
      const archivo = path.join(carpetaTemporal("rol-precios-sin-login"), "sin-login.sql");
      writeFileSync(archivo, sinLogin.stdout);
      expect(ejecutarSql(archivo, superusuario(BASE_PRUEBA)).status).toBe(0);
      try {
        const estado = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
          "SELECT rolcanlogin, rolpassword IS NULL AS sin_clave FROM pg_authid WHERE rolname = 'inv_precios'",
        );
        expect(estado).toEqual([{ rolcanlogin: false, sin_clave: true }]);
        expect(await entrarComoPrecios()).toMatch(/Authentication failed|not permitted to log in|credentials for `inv_precios` are not valid/i);
      } finally {
        await admin.$executeRawUnsafe(`ALTER ROLE inv_precios WITH LOGIN PASSWORD '${CLAVE_PRECIOS}'`);
      }
      expect(await entrarComoPrecios()).toBe("entró");
    });
  });

  // inv_ia (el servicio de los resúmenes con IA, fase E): con el SQL de crear-roles-prod.sh (NOLOGIN y sin clave hasta su
  // secreto), los permisos de privilegios.sql (lista única tests/unit/ia/registro/permisos-ia.ts), los lectores reales y
  // el registro como inv_ia, y lo prohibido falla. Usa lo que sembró el bloque de inv_precios (especies, órdenes y lote).
  describe("inv_ia: el rol del servicio de los resúmenes con IA", () => {
    let ia: PrismaClient;
    let dueno: PrismaClient;
    let sinSecreto: Array<Record<string, unknown>> = [];
    let antesDelMigrador: unknown = null;
    const creaciones: Array<ReturnType<typeof ejecutarSql>> = [];
    const urlIa = () => `${conBase("inv_ia", CLAVE_IA, BASE_PRUEBA)}&connection_limit=1`;
    const negadoIa = async (sql: string) => {
      await expect(ia.$executeRawUnsafe(sql), sql).rejects.toThrow(/42501|permission denied|must be owner/);
    };

    beforeAll(async () => {
      const sqlRol = funcion(ruta008("scripts/crear-roles-prod.sh"), "sql_rol_ia", { PATH: process.env.PATH });
      if (sqlRol.status !== 0) throw new Error(`sql_rol_ia: ${sqlRol.stderr}`);
      const archivo = path.join(carpetaTemporal("rol-ia"), "rol-ia.sql");
      writeFileSync(archivo, sqlRol.stdout);
      for (let i = 0; i < 2; i += 1) creaciones.push(ejecutarSql(archivo, superusuario(BASE_PRUEBA)));
      sinSecreto = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>("SELECT rolcanlogin, rolpassword IS NULL AS sin_clave FROM pg_authid WHERE rolname = 'inv_ia'");
      const enPrueba = new PrismaClient({ datasources: { db: { url: superusuario(BASE_PRUEBA) } } });
      await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_ia WITH LOGIN PASSWORD '${CLAVE_IA}'`);
      await enPrueba.$disconnect();
      ia = new PrismaClient({ datasources: { db: { url: urlIa() } } });
      antesDelMigrador = await ia.$queryRawUnsafe("SELECT id FROM instrumento LIMIT 1").then(() => "leyó", (e: unknown) => String(e));
      dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
      const r = ejecutarSql(ruta008("docker/migrador/privilegios.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
      if (r.status !== 0) throw new Error(`privilegios.sql con inv_ia: ${r.stderr}`);
    }, 120_000);

    afterAll(async () => {
      await ia?.$disconnect();
      await dueno?.$disconnect();
    });

    it("privilegios.sql pasó sin el rol, y el SQL del script lo crea NOLOGIN, sin clave e idempotente; recién creado no lee nada", () => {
      expect(privilegiosSinPrecios?.status, privilegiosSinPrecios?.stderr).toBe(0);
      for (const c of creaciones) expect(c.status, c.stderr).toBe(0);
      expect(sinSecreto).toEqual([{ rolcanlogin: false, sin_clave: true }]);
      expect(String(antesDelMigrador)).toMatch(/42501|permission denied/);
    });

    it("atributos: NOINHERIT, sin superusuario, sin crear bases ni roles, sin replicación ni BYPASSRLS, 2 conexiones y sus topes", async () => {
      const filas = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
        "SELECT rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolconnlimit FROM pg_roles WHERE rolname = 'inv_ia'",
      );
      expect(filas).toEqual([{ rolinherit: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolconnlimit: 2 }]);
      const ajustes = await admin.$queryRawUnsafe<Array<{ ajuste: string }>>("SELECT unnest(rolconfig) AS ajuste FROM pg_roles WHERE rolname = 'inv_ia' ORDER BY 1");
      expect(ajustes.map((a) => a.ajuste)).toEqual(["idle_in_transaction_session_timeout=30s", "statement_timeout=60s"]);
    });

    it("el catálogo tiene exactamente los permisos de la lista, por columna; nada de tabla, secuencia, por defecto, TEMP ni CREATE", async () => {
      const columnas = await dueno.$queryRawUnsafe<Array<{ fila: string }>>(
        `SELECT c.relname || '.' || a.attname || ' ' || x.privilege_type AS fila
           FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace,
                aclexplode(a.attacl) x
          WHERE n.nspname = 'public' AND x.grantee = 'inv_ia'::regrole ORDER BY 1`,
      );
      expect(columnas.map((f) => f.fila).sort()).toEqual(filasIa(PERMISOS_IA));
      const deTabla = await dueno.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT count(*) AS n FROM pg_class c, aclexplode(c.relacl) x WHERE x.grantee = 'inv_ia'::regrole");
      expect(Number(deTabla[0]!.n)).toBe(0);
      const porDefecto = await dueno.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT count(*) AS n FROM pg_default_acl d, aclexplode(d.defaclacl) x WHERE x.grantee = 'inv_ia'::regrole");
      expect(Number(porDefecto[0]!.n)).toBe(0);
      const base = await dueno.$queryRawUnsafe<Array<Record<string, boolean>>>(
        `SELECT has_database_privilege('inv_ia', current_database(), 'CONNECT') AS conecta,
                has_database_privilege('inv_ia', current_database(), 'CREATE') AS crea,
                has_database_privilege('inv_ia', current_database(), 'TEMP') AS temporal,
                has_schema_privilege('inv_ia', 'public', 'USAGE') AS usa,
                has_schema_privilege('inv_ia', 'public', 'CREATE') AS crea_en_esquema`,
      );
      expect(base).toEqual([{ conecta: true, crea: false, temporal: false, usa: true, crea_en_esquema: false }]);
    });

    it("los lectores de los armadores corren como inv_ia (control positivo); los de la página del plan, no", async () => {
      const hoy = new Date("2024-06-20T00:00:00Z");
      const resumen = await obtenerResumen(ia);
      expect(resumen.tablero.filas.length).toBeGreaterThan(0);
      await expect(obtenerEvolucion(ia, resumen)).resolves.toBeDefined();
      await expect(ultimaConciliacion(ia)).resolves.not.toBeUndefined();
      await expect(leerEntradas(ia, hoy)).resolves.toBeDefined();
      await expect(leerProximos(ia, hoy)).resolves.toBeDefined();
      await expect(ultimosCierres(ia, resumen.tablero.filas.map((f) => f.instrumentoId))).resolves.toBeDefined();
      await expect(leerVersiones(ia)).rejects.toThrow(/42501|permission denied/);
      await expect(leerReglas(ia, "version-ficticia")).rejects.toThrow(/42501|permission denied/);
    });

    it("el registro corre como inv_ia: registra con la hora de la base, no repite, lee el último y suma el gasto", async () => {
      const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.REGLAS(), avisos: ["ROLES_BASE_IA"] });
      const prompt = { version: "resumen-reglas-v1", hash: sha256Hex("prompt ficticio de roles-base") };
      const exito = { ok: true, puerta: "local", salidaCruda: "{}", modelo: "ornith:9b", modeloDigest: "digest-ficticio-roles", latenciaMs: 2311, tokensEntrada: 1931, tokensSalida: 287 } as const;
      const entrada = { paquete, prompt, opciones: { temperature: 0, seed: 42 }, validadorVersion: "validador-v1", estado: "PUBLICADO", exito, texto: "Resumen ficticio." } as const;
      const r = await registrarResumen(ia, entrada);
      await expect(registrarResumen(ia, entrada)).rejects.toThrow(expect.objectContaining({ codigo: "YA_PUBLICADO" }));
      expect(await yaPublicado(ia, { tipo: "REGLAS", fechaNegocio: paquete.hoy, hechosHash: paquete.hash, promptHash: prompt.hash, modeloDigest: exito.modeloDigest })).toBe(true);
      expect((await ultimoPublicado(ia, "REGLAS", paquete.hoy))?.id).toBe(r.id);
      expect((await gastoDelMes(ia, "local", new Date(r.generadoEn.getTime() - 1), new Date(r.generadoEn.getTime() + 1))).tokensEntrada).toBe(1931);
    });

    for (const sql of [
      'SELECT "crudo" FROM fila_fuente LIMIT 1',
      'SELECT "encargo" FROM certificacion_fondo LIMIT 1',
      'SELECT "email" FROM usuario LIMIT 1',
      'SELECT "detalle" FROM regla_plan LIMIT 1',
      'SELECT "accion", "cantidad" FROM regla_plan LIMIT 1',
      'SELECT "motivo" FROM plan_version LIMIT 1',
      'SELECT "precioValoracion" FROM certificacion_posicion LIMIT 1',
      "SELECT * FROM instrumento LIMIT 1",
      "UPDATE resumen_ia SET texto = 'x' WHERE false",
      "DELETE FROM resumen_ia WHERE false",
      "TRUNCATE resumen_ia",
      'INSERT INTO resumen_ia ("generadoEn") VALUES (now())',
      "INSERT INTO orden (id) VALUES ('x')",
      "SET ROLE inv_dueno",
      "CREATE TEMP TABLE ia_intrusa (x int)",
      "CREATE TABLE ia_intrusa (x int)",
    ]) {
      it(`inv_ia NO puede: ${sql}`, async () => {
        await negadoIa(sql);
      });
    }

    it("inv_ia NO puede saltarse la solo inserción con SET LOCAL inv.reversion (no tiene UPDATE ni DELETE)", async () => {
      await expect(ia.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
        await tx.$executeRawUnsafe("DELETE FROM resumen_ia");
      })).rejects.toThrow(/42501|permission denied/);
    });

    it("inv_app lee resumen_ia y no escribe en ella", async () => {
      await expect(app.$queryRawUnsafe("SELECT count(*) FROM resumen_ia")).resolves.toBeDefined();
      for (const sql of ["INSERT INTO resumen_ia (id) VALUES ('x')", "UPDATE resumen_ia SET texto = 'x' WHERE false", "DELETE FROM resumen_ia WHERE false"]) {
        await expect(app.$executeRawUnsafe(sql), sql).rejects.toThrow(/42501|permission denied/);
      }
    });

    it("el guardián falla si inv_ia es miembro del dueño (de resumen_ia y de las tablas con disparadores que eximen al dueño)", async () => {
      const guardian = () => ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
      expect(guardian().status).toBe(0);
      await admin.$executeRawUnsafe("GRANT inv_dueno TO inv_ia");
      try {
        const r = guardian();
        expect(r.status).not.toBe(0);
        for (const t of ["resumen_ia", "precio_cierre", "decision"]) expect(r.stderr + r.stdout).toMatch(new RegExp(`rol con privilegios del dueño inv_ia en ${t}\\b`));
      } finally {
        await admin.$executeRawUnsafe("REVOKE inv_dueno FROM inv_ia");
      }
    });
  });

  it("el guardián del esquema pasa en la base recién migrada (definiciones exactas de PostgreSQL 16)", () => {
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status, r.stderr).toBe(0);
  });

  it("el guardián falla si un CHECK cambia de definición o un disparador queda deshabilitado", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe('ALTER TABLE "orden" DROP CONSTRAINT "orden_montos_chk"');
    await dueno.$executeRawUnsafe('ALTER TABLE "orden" ADD CONSTRAINT "orden_montos_chk" CHECK (true)');
    await dueno.$executeRawUnsafe('ALTER TABLE "dividendo" DISABLE TRIGGER "dividendo_solo_insercion"');
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/orden_montos_chk/);
    expect(r.stderr + r.stdout).toMatch(/dividendo_solo_insercion/);
    await dueno.$disconnect();
  });

  // La exención de los disparadores de integridad de precios es «tener los privilegios del dueño de la tabla»: si
  // inv_precios o inv_app fueran miembros de inv_dueno, quedarían eximidos (o, con SET ROLE, serían el dueño).
  // También en las tablas de los instantes del plan y del diario (migración *_instantes_base): con SET ROLE inv_dueno,
  // inv_app fijaría el instante (security-reviewer, MEDIO).
  it("el guardián falla si inv_precios o inv_app es miembro del dueño de las tablas de precios o de los instantes", async () => {
    const guardian = () => ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    const tablas = ["precio_cierre", "valor_unidad_fondo", "plan_version", "decision", "enlace_decision_orden"];
    for (const rol of ["inv_precios", "inv_app"]) {
      const avisos = tablas.map((t) => new RegExp(`rol con privilegios del dueño ${rol} en ${t}\\b`));
      const antes = guardian();
      for (const aviso of avisos) expect(antes.stderr + antes.stdout).not.toMatch(aviso);
      await admin.$executeRawUnsafe(`GRANT inv_dueno TO ${rol}`);
      try {
        const r = guardian();
        expect(r.status).not.toBe(0);
        for (const aviso of avisos) expect(r.stderr + r.stdout).toMatch(aviso);
      } finally {
        await admin.$executeRawUnsafe(`REVOKE inv_dueno FROM ${rol}`);
      }
    }
  });

  it("el guardián del esquema falla si falta un disparador escrito a mano", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe('DROP TRIGGER "orden_solo_insercion" ON "orden"');
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/orden_solo_insercion/);
    await dueno.$disconnect();
  });
});

describe("roles de producción · fuera de CI", () => {
  it.skipIf(EN_CI)("se salta en el Mac a propósito: la verificación local se hace en el proyecto inv-008-prueba", () => {
    expect(EN_CI).toBe(false);
  });
});
