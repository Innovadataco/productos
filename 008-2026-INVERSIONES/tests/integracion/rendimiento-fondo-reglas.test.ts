// Reglas de la base para los rendimientos del fondo (frente fondo-rendimientos, T1) contra la base de PRUEBAS:
// - rendimiento_fondo: valor > 0 (sin NaN), fecha finita, un hecho por (fondo, fecha, tipo) y por fila cruda;
// - solo el RENDIMIENTO lleva su ajuste de caja (la RETENCION es un hecho del fondo: el pago ya llega neto a la caja),
//   y ese ajuste es un RENDIMIENTO_FIC de la MISMA fecha con monto = valor;
// - el fondo es un FIC; ajuste_caja no admite un RENDIMIENTO_FIC que salga de la caja;
// - rendimiento_fondo es de solo inserción.
// Cada caso corre en una transacción que se deshace: no deja filas. Datos inventados (2027, cifras raras).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
let n = 0;
const unico = () => `${corrida}-${(n += 1)}`;
const dec = (v: string) => new Prisma.Decimal(v);

type Tx = Prisma.TransactionClient;
class Deshacer extends Error {}

/** Corre `cuerpo` en una transacción que siempre se deshace; devuelve el error que lanzó o null. */
async function enTransaccionDeshecha(cuerpo: (tx: Tx) => Promise<void>): Promise<string | null> {
  let error: string | null = null;
  try {
    await db.$transaction(
      async (tx) => {
        try {
          await cuerpo(tx);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        throw new Deshacer();
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  return error;
}

const FECHA = new Date("2027-05-21T00:00:00Z");
const OTRA_FECHA = new Date("2027-05-24T00:00:00Z");
const VALOR = "48213.3719";
const RETENCION = "1748.6233";

const usuario = (tx: Tx) => tx.usuario.create({ data: { email: `reglas-rendimiento-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
const fondo = (tx: Tx, tipo: "FIC" | "ACCION" = "FIC") =>
  tx.instrumento.create({
    data: tipo === "FIC" ? { tipo, codigoFic: `6${Date.now() % 1_000_000}${(n += 1)}`, nombre: "Fondo ficticio de rendimientos" } : { tipo, nemotecnico: `FICTA${(n += 1)}`, nombre: "Acción ficticia" },
  });

async function filaCruda(tx: Tx, usuarioId: string) {
  const carga = await tx.cargaArchivo.create({
    data: { tipoFuente: "REGISTRO_RENDIMIENTOS_FIC", nombreArchivo: "rendimientos-fondo.csv", sha256: "e".repeat(64), estado: "CARGADO", cargadoPorId: usuarioId },
  });
  return tx.filaFuente.create({
    data: { tipoFuente: "REGISTRO_RENDIMIENTOS_FIC", claveNatural: unico().padEnd(64, "0").slice(0, 64), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 2, crudo: { ficticio: "si" } },
  });
}

async function ajuste(tx: Tx, usuarioId: string, datos: Partial<Prisma.AjusteCajaUncheckedCreateInput> = {}) {
  return tx.ajusteCaja.create({
    data: { fecha: FECHA, monto: dec(VALOR), categoria: "RENDIMIENTO_FIC", fuente: "EXTRACTO", motivo: "rendimiento ficticio", creadoPorId: usuarioId, ...datos },
  });
}

interface Opciones {
  readonly hecho?: Partial<Prisma.RendimientoFondoUncheckedCreateInput>;
  readonly ajuste?: Partial<Prisma.AjusteCajaUncheckedCreateInput> | null;
  readonly tipoFondo?: "FIC" | "ACCION";
}

/** Un rendimiento coherente con su ajuste de caja; las opciones cambian lo que se quiera romper. */
async function rendimiento(tx: Tx, o: Opciones = {}) {
  const u = await usuario(tx);
  const f = await fondo(tx, o.tipoFondo);
  const fila = await filaCruda(tx, u.id);
  const a = o.ajuste === null ? null : await ajuste(tx, u.id, o.ajuste);
  return tx.rendimientoFondo.create({
    data: { filaFuenteId: fila.id, fondoId: f.id, fecha: FECHA, tipo: "RENDIMIENTO", valor: dec(VALOR), ajusteCajaId: a?.id ?? null, ...o.hecho },
  });
}

/** Una retención, sin ajuste de caja. */
async function retencion(tx: Tx, fondoId: string, usuarioId: string, datos: Partial<Prisma.RendimientoFondoUncheckedCreateInput> = {}) {
  const fila = await filaCruda(tx, usuarioId);
  return tx.rendimientoFondo.create({ data: { filaFuenteId: fila.id, fondoId, fecha: FECHA, tipo: "RETENCION", valor: dec(RETENCION), ...datos } });
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("rendimiento_fondo · control positivo", () => {
  it("un rendimiento con su ajuste RENDIMIENTO_FIC (+valor, misma fecha) y una retención sin ajuste se guardan", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const r = await rendimiento(tx);
        const u = await usuario(tx);
        await retencion(tx, r.fondoId, u.id);
      }),
    ).toBeNull();
  });
});

describe("rendimiento_fondo · valores", () => {
  it("valor en 0 o negativo se rechaza", async () => {
    for (const valor of ["0", "-1748.6233"]) {
      const error = await enTransaccionDeshecha(async (tx) => {
        const u = await usuario(tx);
        const f = await fondo(tx);
        await retencion(tx, f.id, u.id, { valor: dec(valor) });
      });
      expect(error, valor).toMatch(/rendimiento_fondo_valor_chk/);
    }
  });

  it("valor NaN se rechaza (NaN > 0 es verdadero en PostgreSQL)", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const f = await fondo(tx);
      const fila = await filaCruda(tx, u.id);
      await tx.$executeRaw`INSERT INTO "rendimiento_fondo" ("id", "filaFuenteId", "fondoId", "fecha", "tipo", "valor") VALUES (${unico()}, ${fila.id}, ${f.id}, ${FECHA}, 'RETENCION', 'NaN'::numeric)`;
    });
    expect(error).toMatch(/rendimiento_fondo_valor_chk/);
  });

  it("una fecha infinita se rechaza", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const f = await fondo(tx);
      const fila = await filaCruda(tx, u.id);
      await tx.$executeRaw`INSERT INTO "rendimiento_fondo" ("id", "filaFuenteId", "fondoId", "fecha", "tipo", "valor") VALUES (${unico()}, ${fila.id}, ${f.id}, 'infinity'::date, 'RETENCION', ${dec(RETENCION)})`;
    });
    expect(error).toMatch(/rendimiento_fondo_fecha_chk/);
  });
});

describe("rendimiento_fondo · enlace con la caja", () => {
  it("un RENDIMIENTO sin su ajuste de caja se rechaza", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { ajuste: null })))).toMatch(/rendimiento_fondo_enlace_chk/);
  });

  it("una RETENCION con ajuste de caja se rechaza (no mueve la caja)", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { hecho: { tipo: "RETENCION" } })))).toMatch(/rendimiento_fondo_enlace_chk/);
  });

  it("el ajuste enlazado debe ser RENDIMIENTO_FIC, de la misma fecha y con monto = valor", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { ajuste: { categoria: "INTERES" } })))).toMatch(/no es un rendimiento del fondo/);
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { ajuste: { fecha: OTRA_FECHA } })))).toMatch(/otra fecha/);
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { ajuste: { monto: dec("48213.3718") } })))).toMatch(/no es el valor del rendimiento/);
  });

  it("el fondo debe ser un FIC (no una acción)", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await rendimiento(tx, { tipoFondo: "ACCION" })))).toMatch(/no es un fondo/);
  });

  it("ajuste_caja no admite un RENDIMIENTO_FIC negativo (sale de la caja)", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      await ajuste(tx, u.id, { monto: dec("-48213.3719") });
    });
    expect(error).toMatch(/ajuste_caja_rendimiento_fic_chk/);
  });
});

describe("rendimiento_fondo · únicos", () => {
  it("un solo hecho por fondo, fecha y tipo", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const f = await fondo(tx);
      await retencion(tx, f.id, u.id);
      await retencion(tx, f.id, u.id, { valor: dec("1748.6234") });
    });
    expect(error).toMatch(/Unique constraint failed/);
  });

  it("una fila cruda es de un solo hecho", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const f = await fondo(tx);
      const r = await retencion(tx, f.id, u.id);
      await tx.rendimientoFondo.create({ data: { filaFuenteId: r.filaFuenteId, fondoId: f.id, fecha: OTRA_FECHA, tipo: "RETENCION", valor: dec(RETENCION) } });
    });
    expect(error).toMatch(/Unique constraint failed/);
  });

  it("un ajuste de caja es de un solo rendimiento", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const r = await rendimiento(tx);
      const u = await usuario(tx);
      const otro = await fondo(tx);
      const fila = await filaCruda(tx, u.id);
      await tx.rendimientoFondo.create({ data: { filaFuenteId: fila.id, fondoId: otro.id, fecha: FECHA, tipo: "RENDIMIENTO", valor: dec(VALOR), ajusteCajaId: r.ajusteCajaId } });
    });
    expect(error).toMatch(/Unique constraint failed/);
  });
});

describe("rendimiento_fondo · solo inserción", () => {
  it("no se cambia ni se borra", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const r = await rendimiento(tx);
        await tx.rendimientoFondo.update({ where: { id: r.id }, data: { valor: dec("48213.372") } });
      }),
    ).toMatch(/solo inserción/);
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const r = await rendimiento(tx);
        await tx.rendimientoFondo.delete({ where: { id: r.id } });
      }),
    ).toMatch(/solo inserción/);
  });
});
