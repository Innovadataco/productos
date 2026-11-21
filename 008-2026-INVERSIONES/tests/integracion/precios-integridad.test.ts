// Integridad de los precios (migración *_precios_integridad) contra la base de PRUEBAS, en el Mac y en el CI.
// Los disparadores se aplican a todo rol que NO tenga los privilegios del dueño de la tabla; el superusuario y el
// dueño quedan fuera (fixtures, vía B, depuración). Aquí el «no dueño» es el rol predefinido pg_write_all_data, que
// existe en todo clúster de PostgreSQL 16 y escribe en todas las tablas (también lo que inv_precios no puede: así se
// prueba la defensa en profundidad). Cada caso corre en UNA transacción que siempre se deshace: siembra como
// superusuario, le da SELECT de lo que lee el disparador, SET LOCAL ROLE y el ataque. No crea ni cambia roles (son
// globales del clúster, y el del Mac tiene la base de trabajo). La prueba con inv_precios real es roles-base.test.ts.
// Datos inventados (tests/ayudas/integridad-precios.ts).
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACEPTADOS, RECHAZOS, idsDe, sembrar, type Ids } from "../ayudas/integridad-precios";

const db = new PrismaClient();
const NO_DUENO = "pg_write_all_data";
const LECTURAS = `GRANT SELECT ON TABLE precio_cierre, valor_unidad_fondo, certificacion, certificacion_posicion TO ${NO_DUENO}`;

class Deshacer extends Error {}

interface Resultado {
  readonly error: string | null;
  readonly filas: unknown;
}

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * En una transacción que siempre se deshace: siembra el escenario como superusuario y corre `sql` como `rol`
 * (o como superusuario si es null). Si no falla, corre `verificar` como superusuario. Devuelve el error o las filas.
 */
async function enTransaccion(rol: string | null, sql: (ids: Ids) => readonly string[], verificar?: (ids: Ids) => string): Promise<Resultado> {
  const ids = idsDe(randomBytes(4).toString("hex"));
  let error: string | null = null;
  let filas: unknown = null;
  try {
    await db.$transaction(
      async (tx) => {
        for (const s of sembrar(ids)) await tx.$executeRawUnsafe(s);
        if (rol) {
          await tx.$executeRawUnsafe(LECTURAS);
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${rol}`);
        }
        try {
          for (const s of sql(ids)) await tx.$executeRawUnsafe(s);
        } catch (e) {
          error = mensaje(e);
          throw new Deshacer();
        }
        if (rol) await tx.$executeRawUnsafe("RESET ROLE");
        if (verificar) filas = await tx.$queryRawUnsafe(verificar(ids));
        throw new Deshacer();
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  return { error, filas };
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("integridad de los precios: lo que un rol que no es dueño no puede afirmar", () => {
  for (const caso of RECHAZOS) {
    it(`rechaza: ${caso.nombre}`, async () => {
      const r = await enTransaccion(NO_DUENO, caso.sql);
      expect(r.error).toMatch(caso.error);
    });
  }
});

describe("integridad de los precios: lo legítimo entra (los instantes los pone la base)", () => {
  for (const caso of ACEPTADOS) {
    it(`entra: ${caso.nombre}`, async () => {
      const r = await enTransaccion(NO_DUENO, caso.sql, caso.verificar);
      expect(r.error).toBeNull();
      expect(r.filas).toEqual([{ ok: true }]);
    });
  }
});

describe("integridad de los precios: el dueño y el superusuario quedan fuera (fixtures, vía B, depuración)", () => {
  it("el superusuario inserta VERIFICADO sin certificación, con otra fuente, retirado y con su propio traidoEn", async () => {
    const r = await enTransaccion(
      null,
      (i) => [
        `INSERT INTO precio_cierre (id, "instrumentoId", fecha, precio, fuente, estado, "traidoEn", "reemplazadoEn") VALUES ('su-${i.sufijo}', '${i.inst}', DATE '2018-05-09', 3719.41, 'e2e-ficticio', 'VERIFICADO', TIMESTAMPTZ '2003-07-19 08:41:13+00', TIMESTAMPTZ '2003-07-21 14:07:29+00')`,
      ],
      (i) => `SELECT ("traidoEn" = TIMESTAMPTZ '2003-07-19 08:41:13+00' AND "reemplazadoEn" = TIMESTAMPTZ '2003-07-21 14:07:29+00' AND estado = 'VERIFICADO') AS ok FROM precio_cierre WHERE id = 'su-${i.sufijo}'`,
    );
    expect(r.error).toBeNull();
    expect(r.filas).toEqual([{ ok: true }]);
  });

  it("el superusuario reabre, vuelve a fechar y borra (no lo frena el disparador)", async () => {
    const r = await enTransaccion(
      null,
      (i) => [
        `UPDATE precio_cierre SET "reemplazadoEn" = NULL WHERE id = '${i.retirado}'`,
        `UPDATE valor_unidad_fondo SET "reemplazadoEn" = TIMESTAMPTZ '2003-07-19 08:41:13+00' WHERE id = '${i.vufRetirado}'`,
        `DELETE FROM precio_cierre WHERE id = '${i.vigente}'`,
        `DELETE FROM valor_unidad_fondo WHERE id = '${i.vufVigente}'`,
      ],
      (i) => `SELECT ((SELECT "reemplazadoEn" IS NULL FROM precio_cierre WHERE id = '${i.retirado}') AND NOT EXISTS (SELECT 1 FROM precio_cierre WHERE id = '${i.vigente}')) AS ok`,
    );
    expect(r.error).toBeNull();
    expect(r.filas).toEqual([{ ok: true }]);
  });

  it("el rol no dueño de verdad no es dueño (control: sin esto, todo lo de arriba probaría al superusuario)", async () => {
    const r = await enTransaccion(NO_DUENO, () => [], () =>
      `SELECT NOT pg_has_role('${NO_DUENO}', (SELECT relowner FROM pg_class WHERE oid = 'public.precio_cierre'::regclass), 'USAGE') AS ok`);
    expect(r.filas).toEqual([{ ok: true }]);
  });
});
