// Roles de producción contra una PostgreSQL 16 real: crear-roles-prod.sql + migraciones como inv_dueno +
// guardián del esquema + privilegios.sql, y luego inv_app intenta lo que nunca debe poder hacer. Después, inv_precios
// (servicio de precios, PR 3): privilegios.sql pasa sin el rol (el despliegue de hoy), el rol se crea con el SQL de
// crear-roles-prod.sh, privilegios.sql se reaplica, precios:actualizar y actualizar-fondo corren con él (buscadores
// simulados) y lo prohibido falla. Todo en este archivo: los roles son globales del clúster.
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
import { actualizarPrecios } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";
import { carpetaTemporal, funcion, ruta008 } from "./falsos";
import { filasPermisos, PERMISOS_PRECIOS } from "./permisos-precios";

const URL_BASE = process.env.DATABASE_URL_TEST ?? "";
const EN_CI = process.env.GITHUB_ACTIONS === "true";
const BASE_PRUEBA = "inv_roles_test";
const CLAVE_DUENO = "d".repeat(48);
const CLAVE_APP = "e".repeat(48);
const CLAVE_PRECIOS = "f".repeat(48);
const ROLES = "('inv_dueno','inv_app','inv_precios')";

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
    const urlPrecios = () => `${conBase("inv_precios", CLAVE_PRECIOS, BASE_PRUEBA)}&connection_limit=2`;
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
      const enPrueba = new PrismaClient({ datasources: { db: { url: superusuario(BASE_PRUEBA) } } });
      await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_precios PASSWORD '${CLAVE_PRECIOS}'`);
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

    it("atributos del rol: LOGIN, NOINHERIT, sin superusuario, sin crear bases ni roles, sin replicación ni BYPASSRLS, 3 conexiones", async () => {
      const filas = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
        "SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolconnlimit FROM pg_roles WHERE rolname = 'inv_precios'",
      );
      expect(filas).toEqual([{ rolcanlogin: true, rolinherit: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolconnlimit: 3 }]);
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
      "SELECT cantidad FROM orden",
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
