// Los instantes del plan y del diario los pone la BASE (migración *_instantes_base), contra la base de PRUEBAS, en el
// Mac y en el CI: plan_version."creadaEn", decision."registradaEn" y enlace_decision_orden."creadoEn".
//  - Un rol que NO es el dueño (aquí pg_write_all_data, que escribe en todo, también en esas columnas: es inv_app con
//    el permiso de columna dado por error) no los puede fijar: el disparador los pisa con clock_timestamp().
//  - El dueño sí (restauraciones de solo datos, reparaciones); si no los manda, los pone el DEFAULT clock_timestamp().
//  - Es el momento de la fila, no el de la transacción (now()) ni el de la sentencia (statement_timestamp()): una
//    transacción o una sentencia sostenidas no fechan en el pasado.
//  - Si se rompe una de sus piezas, el guardián del esquema la nombra.
// Cada caso corre en UNA transacción que siempre se deshace (siembra como superusuario, SET LOCAL ROLE, el intento,
// RESET ROLE y la lectura). No crea ni cambia roles (son globales del clúster, y el del Mac tiene la base de trabajo).
// La prueba con inv_app real es tests/unit/produccion/roles-base.test.ts (solo CI). Datos inventados.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const NO_DUENO = "pg_write_all_data";
const ANTEDATADO = "TIMESTAMPTZ '2019-02-11 10:37:00+00'";
const guardian = readFileSync(fileURLToPath(new URL("../../scripts/verificar-esquema.sql", import.meta.url)), "utf8");

class Deshacer extends Error {}
type Tx = Prisma.TransactionClient;

interface Ids {
  readonly usuario: string;
  readonly instrumento: string;
  readonly orden: string;
  /** La siguiente versión del plan (la lee el dueño: pg_write_all_data no lee). */
  readonly version: number;
}

/** Corre `cuerpo` en una transacción que siempre se deshace y devuelve lo que devolvió. */
async function enTransaccion<T>(cuerpo: (tx: Tx, ids: Ids) => Promise<T>): Promise<T> {
  const salida: T[] = [];
  try {
    await db.$transaction(
      async (tx) => {
        salida.push(await cuerpo(tx, await sembrar(tx)));
        throw new Deshacer();
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  if (salida.length !== 1) throw new Error("la transacción no devolvió nada");
  return salida[0]!;
}

/** Usuario, especie y una orden de venta, como superusuario (el dueño), dentro de la transacción. */
async function sembrar(tx: Tx): Promise<Ids> {
  const k = randomBytes(4).toString("hex");
  const u = await tx.usuario.create({ data: { email: `instantes-${k}@ejemplo.invalid`, rol: "DUENO" } });
  const inst = await tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `IB${k}`.toUpperCase(), nombre: "Acción ficticia de los instantes" } });
  const carga = await tx.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-instantes.ficticio.csv", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: u.id } });
  const fila = await tx.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: `instantes-${k}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: { ficticio: true } } });
  const orden = await tx.orden.create({
    data: {
      filaFuenteId: fila.id, ejecutadaEn: new Date("2019-02-13T19:41:00Z"), fechaOperacion: new Date("2019-02-13T00:00:00Z"), fechaLiquidacion: new Date("2019-02-15T00:00:00Z"),
      instrumentoId: inst.id, lado: "VENTA", estado: "APROBADO", cantidadCompletada: 37n, precioUnitario: new Prisma.Decimal("12.37"),
      totalInvertido: new Prisma.Decimal("457.69"), comision: new Prisma.Decimal("4.61"), totalEstimado: new Prisma.Decimal("453.08"),
    },
  });
  const ultima = await tx.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
  return { usuario: u.id, instrumento: inst.id, orden: orden.id, version: (ultima?.version ?? 0) + 1 };
}

/** Los INSERT de las tres tablas con un instante (o sin él, si es null), en el orden de las FK. */
function inserts(ids: Ids, k: string, instante: string | null, prefijo = ""): readonly string[] {
  const col = (c: string) => (instante === null ? "" : `, "${c}"`);
  const val = instante === null ? "" : `, ${instante}`;
  return [
    `${prefijo}INSERT INTO plan_version (id, version, "vigenteDesde", motivo, "aprobadaPorId"${col("creadaEn")})
       SELECT 'ib-v-${k}', ${ids.version}, DATE '2019-02-04', 'Versión ficticia', '${ids.usuario}'${val}`,
    `${prefijo}INSERT INTO decision (id, "planVersionId", "instrumentoId", accion, motivo, "decididaPorId", "fechaDecision"${col("registradaEn")})
       SELECT 'ib-d-${k}', 'ib-v-${k}', '${ids.instrumento}', 'VENDER', 'Decisión ficticia', '${ids.usuario}', DATE '2019-02-12'${val}`,
    `${prefijo}INSERT INTO enlace_decision_orden (id, "ordenId", "decisionId", "creadoPorId"${col("creadoEn")})
       SELECT 'ib-e-${k}', '${ids.orden}', 'ib-d-${k}', '${ids.usuario}'${val}`,
  ];
}

interface Instantes {
  readonly version: Date;
  readonly decision: Date;
  readonly enlace: Date;
  readonly fechaDecision: Date;
}

async function leer(tx: Tx, k: string): Promise<Instantes> {
  const filas = await tx.$queryRawUnsafe<Instantes[]>(
    `SELECT v."creadaEn" AS version, d."registradaEn" AS decision, e."creadoEn" AS enlace, d."fechaDecision" AS "fechaDecision"
       FROM plan_version v JOIN decision d ON d."planVersionId" = v.id JOIN enlace_decision_orden e ON e."decisionId" = d.id
      WHERE v.id = 'ib-v-${k}'`,
  );
  expect(filas).toHaveLength(1);
  return filas[0]!;
}

const reloj = async (tx: Tx): Promise<Date> => (await tx.$queryRaw<{ t: Date }[]>`SELECT clock_timestamp() AS t`)[0]!.t;
const inicioTx = async (tx: Tx): Promise<Date> => (await tx.$queryRaw<{ t: Date }[]>`SELECT now() AS t`)[0]!.t;
const los3 = (i: Instantes): Date[] => [i.version, i.decision, i.enlace];

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("los instantes del plan y del diario los pone la base", () => {
  it("un rol que no es el dueño, aunque tenga el permiso de columna, no los antedata: el disparador pone la hora de la base", async () => {
    const r = await enTransaccion(async (tx, ids) => {
      const antes = await reloj(tx);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${NO_DUENO}`);
      for (const s of inserts(ids, "a", ANTEDATADO)) await tx.$executeRawUnsafe(s);
      await tx.$executeRawUnsafe("RESET ROLE");
      return { antes, despues: await reloj(tx), filas: await leer(tx, "a") };
    });
    for (const t of los3(r.filas)) {
      expect(t.getTime()).toBeGreaterThanOrEqual(r.antes.getTime());
      expect(t.getTime()).toBeLessThanOrEqual(r.despues.getTime());
    }
    // Solo el instante: lo demás de la fila queda como vino.
    expect(r.filas.fechaDecision.toISOString().slice(0, 10)).toBe("2019-02-12");
  });

  it("en un INSERT de varias filas, el disparador fija el instante de cada una (FOR EACH ROW)", async () => {
    const r = await enTransaccion(async (tx, ids) => {
      const antes = await reloj(tx);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${NO_DUENO}`);
      await tx.$executeRawUnsafe(
        `INSERT INTO plan_version (id, version, "vigenteDesde", motivo, "aprobadaPorId", "creadaEn") VALUES
           ('ib-m1', ${ids.version}, DATE '2019-02-04', 'Versión ficticia', '${ids.usuario}', ${ANTEDATADO}),
           ('ib-m2', ${ids.version + 1}, DATE '2019-02-05', 'Versión ficticia', '${ids.usuario}', ${ANTEDATADO}),
           ('ib-m3', ${ids.version + 2}, DATE '2019-02-06', 'Versión ficticia', '${ids.usuario}', ${ANTEDATADO})`,
      );
      await tx.$executeRawUnsafe("RESET ROLE");
      const filas = await tx.$queryRawUnsafe<{ t: Date }[]>(`SELECT "creadaEn" AS t FROM plan_version WHERE id IN ('ib-m1', 'ib-m2', 'ib-m3')`);
      return { antes, despues: await reloj(tx), filas };
    });
    expect(r.filas).toHaveLength(3);
    for (const { t } of r.filas) {
      expect(t.getTime()).toBeGreaterThanOrEqual(r.antes.getTime());
      expect(t.getTime()).toBeLessThanOrEqual(r.despues.getTime());
    }
  });

  it("el dueño conserva el instante que manda (restauración de solo datos, reparaciones)", async () => {
    const r = await enTransaccion(async (tx, ids) => {
      for (const s of inserts(ids, "b", ANTEDATADO)) await tx.$executeRawUnsafe(s);
      return leer(tx, "b");
    });
    for (const t of los3(r)) expect(t.toISOString()).toBe("2019-02-11T10:37:00.000Z");
  });

  it.each([
    ["el dueño sin el instante (el DEFAULT)", null],
    ["un rol que no es el dueño (el disparador)", NO_DUENO],
  ])("%s: en una transacción sostenida, la hora es la de la fila, no la del inicio (now())", async (_caso, rol) => {
    const r = await enTransaccion(async (tx, ids) => {
      const inicio = await inicioTx(tx);
      await tx.$executeRawUnsafe("SELECT pg_sleep(0.25)");
      if (rol) await tx.$executeRawUnsafe(`SET LOCAL ROLE ${rol}`);
      for (const s of inserts(ids, "c", rol ? ANTEDATADO : null)) await tx.$executeRawUnsafe(s);
      if (rol) await tx.$executeRawUnsafe("RESET ROLE");
      return { inicio, filas: await leer(tx, "c") };
    });
    for (const t of los3(r.filas)) expect(t.getTime() - r.inicio.getTime()).toBeGreaterThanOrEqual(250);
  });

  it.each([
    ["el dueño sin el instante (el DEFAULT)", null],
    ["un rol que no es el dueño (el disparador)", NO_DUENO],
  ])("%s: en una sentencia sostenida, la hora es la de la fila, no la del comienzo de la sentencia", async (_caso, rol) => {
    const r = await enTransaccion(async (tx, ids) => {
      if (rol) await tx.$executeRawUnsafe(`SET LOCAL ROLE ${rol}`);
      const [v, d, e] = inserts(ids, "d", rol ? ANTEDATADO : null);
      await tx.$executeRawUnsafe(v!);
      await tx.$executeRawUnsafe(d!);
      if (rol) await tx.$executeRawUnsafe("RESET ROLE");
      const antes = await reloj(tx);
      if (rol) await tx.$executeRawUnsafe(`SET LOCAL ROLE ${rol}`);
      // La fila del enlace sale de una CTE que duerme: la sentencia empezó antes del sueño.
      await tx.$executeRawUnsafe(`WITH s AS (SELECT pg_sleep(0.25)) ${e!} FROM s`);
      if (rol) await tx.$executeRawUnsafe("RESET ROLE");
      return { antes, filas: await leer(tx, "d") };
    });
    expect(r.filas.enlace.getTime() - r.antes.getTime()).toBeGreaterThanOrEqual(250);
  });
});

// Rompe con DDL dentro de una transacción (toma ACCESS EXCLUSIVE de decision o plan_version hasta deshacerla): es
// seguro porque la integración corre los archivos de a uno (fileParallelism: false en vitest.integracion.config.ts).
describe("guardián del esquema: las piezas de los instantes", () => {
  /** Rompe algo, corre el guardián en la misma transacción y la deshace; devuelve su error o null. */
  async function guardianTras(romper: readonly string[]): Promise<string | null> {
    let error: string | null = null;
    try {
      await db.$transaction(
        async (tx) => {
          for (const sql of romper) await tx.$executeRawUnsafe(sql);
          try {
            await tx.$executeRawUnsafe(guardian);
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }
          throw new Deshacer();
        },
        { timeout: 30_000 },
      );
    } catch (e) {
      if (!(e instanceof Deshacer)) throw e;
    }
    return error;
  }

  // Control positivo (database-reviewer, MEDIO): con un md5 o una definición mal copiados, el guardián fallaría en cada
  // despliegue real y los casos de abajo seguirían pasando.
  it("pasa sin cambios: las tres funciones y los tres disparadores están como los dejó la migración", async () => {
    expect(await guardianTras([])).toBeNull();
  });

  it.each([
    ["falta un disparador", ['DROP TRIGGER "decision_instante" ON "decision"'], /disparador decision_instante/],
    ["un disparador deshabilitado", ['ALTER TABLE "plan_version" DISABLE TRIGGER "plan_version_instante"'], /disparador plan_version_instante/],
    ["una función SECURITY DEFINER (dentro, current_user sería el dueño)", ['ALTER FUNCTION "inv_enlace_decision_orden_instante"() SECURITY DEFINER'], /función inv_enlace_decision_orden_instante/],
    ["una función con otro search_path", ['ALTER FUNCTION "inv_decision_instante"() SET search_path = public'], /función inv_decision_instante/],
    [
      "una función con otro cuerpo (que ya no fija el instante)",
      [`CREATE OR REPLACE FUNCTION "inv_plan_version_instante"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`],
      /función inv_plan_version_instante/,
    ],
  ])("lo nombra si %s", async (_caso, romper, aviso) => {
    expect(await guardianTras(romper)).toMatch(aviso);
  });
});
