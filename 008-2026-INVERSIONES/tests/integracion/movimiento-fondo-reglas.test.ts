// Reglas de la base para las unidades del fondo (frente fondo-movimientos, T1) contra la base de PRUEBAS:
// - movimiento_fondo: unidades > 0 (un AJUSTE, distinto de 0), monto nulo o > 0, una constitución o un aporte
//   exigen su ajuste de caja y su monto, y un fondo tiene a lo sumo una constitución;
// - el ajuste enlazado es un APORTE_FIC de la MISMA fecha y su monto es el del movimiento con el signo de salida;
// - ajuste_caja y movimiento_fondo son de solo inserción (la salida es `inv.reversion`, como en las demás).
// Cada caso corre en una transacción que se deshace: no deja filas. Datos inventados.
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

// Cifras y fechas inventadas (no redondas; 2027).
const FECHA = new Date("2027-06-23T00:00:00Z");
const OTRA_FECHA = new Date("2027-06-24T00:00:00Z");
const UNIDADES = "1031.77246";
const MONTO = "4729813.4127";

const usuario = (tx: Tx) => tx.usuario.create({ data: { email: `reglas-fondo-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
const fondo = (tx: Tx) => tx.instrumento.create({ data: { tipo: "FIC", codigoFic: `7${Date.now() % 1_000_000}${n += 1}`, nombre: "Fondo ficticio de reglas" } });

async function ajuste(tx: Tx, datos: Partial<Prisma.AjusteCajaUncheckedCreateInput> = {}) {
  const u = await usuario(tx);
  return tx.ajusteCaja.create({
    data: { fecha: FECHA, monto: dec(`-${MONTO}`), categoria: "APORTE_FIC", fuente: "EXTRACTO", motivo: "aporte ficticio", creadoPorId: u.id, ...datos },
  });
}

/** Una constitución coherente con su ajuste; `datos` cambia lo que se quiera romper. */
async function constitucion(tx: Tx, datos: Partial<Prisma.MovimientoFondoUncheckedCreateInput> = {}, deAjuste: Partial<Prisma.AjusteCajaUncheckedCreateInput> = {}) {
  const fic = await fondo(tx);
  const a = await ajuste(tx, deAjuste);
  return tx.movimientoFondo.create({
    data: { fondoId: fic.id, fecha: FECHA, unidades: dec(UNIDADES), monto: dec(MONTO), tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: a.id, ...datos },
  });
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("movimiento_fondo · valores", () => {
  it("una constitución coherente con su ajuste de caja se guarda", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx)))).toBeNull();
  });

  it("unidades en 0 o negativas se rechazan", async () => {
    for (const unidades of ["0", "-3.14159"]) {
      expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, { unidades: dec(unidades) })))).toMatch(/movimiento_fondo_unidades_chk/);
    }
  });

  it("un AJUSTE admite unidades negativas (la corrección compensatoria), pero nunca 0", async () => {
    const ajusteDe = (unidades: string) =>
      enTransaccionDeshecha(async (tx) => {
        const fic = await fondo(tx);
        await tx.movimientoFondo.create({ data: { fondoId: fic.id, fecha: FECHA, unidades: dec(unidades), tipo: "AJUSTE", fuente: "MANUAL" } });
      });
    expect(await ajusteDe("-2.71828")).toBeNull();
    expect(await ajusteDe("0")).toMatch(/movimiento_fondo_unidades_chk/);
  });

  it("un monto en 0 o negativo se rechaza", async () => {
    for (const monto of ["0", "-17.3"]) {
      expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, { monto: dec(monto) })))).toMatch(/movimiento_fondo_monto_chk/);
    }
  });

  it("una constitución o un aporte exigen su ajuste de caja y su monto", async () => {
    for (const tipo of ["CONSTITUCION", "APORTE"] as const) {
      const sinAjuste = await enTransaccionDeshecha(async (tx) => {
        const fic = await fondo(tx);
        await tx.movimientoFondo.create({ data: { fondoId: fic.id, fecha: FECHA, unidades: dec(UNIDADES), monto: dec(MONTO), tipo, fuente: "EXTRACTO" } });
      });
      expect(sinAjuste).toMatch(/movimiento_fondo_aporte_enlace_chk/);
      expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, { tipo, monto: null })))).toMatch(/movimiento_fondo_aporte_enlace_chk/);
    }
  });
});

describe("movimiento_fondo · unicidad", () => {
  it("un fondo no admite dos constituciones (aunque sean de otra fecha)", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const primera = await constitucion(tx);
      const a = await ajuste(tx, { fecha: OTRA_FECHA });
      await tx.movimientoFondo.create({
        data: { fondoId: primera.fondoId, fecha: OTRA_FECHA, unidades: dec(UNIDADES), monto: dec(MONTO), tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: a.id },
      });
    });
    expect(error).toMatch(/Unique constraint|movimiento_fondo_constitucion_key/);
  });
});

describe("movimiento_fondo · coherencia con su ajuste de caja", () => {
  it("un ajuste de otra categoría se rechaza", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, {}, { categoria: "GMF" })))).toMatch(/no es un aporte al fondo/);
  });

  it("un ajuste de otra fecha se rechaza", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, {}, { fecha: OTRA_FECHA })))).toMatch(/otra fecha/);
  });

  it("un ajuste positivo (dinero que entra) o con otro monto se rechaza", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, {}, { monto: dec(MONTO) })))).toMatch(/monto del ajuste/);
    expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, {}, { monto: dec("-4729813.4126") })))).toMatch(/monto del ajuste/);
  });

  it("solo una constitución o un aporte se enlazan a un ajuste de caja", async () => {
    for (const tipo of ["RETIRO", "AJUSTE"] as const) {
      expect(await enTransaccionDeshecha(async (tx) => void (await constitucion(tx, { tipo })))).toMatch(/solo una constitución o un aporte/);
    }
  });

  it("cambiar el enlace, la fecha o el monto con la salida de reversión vuelve a pasar por la coherencia", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const m = await constitucion(tx);
      await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
      await tx.movimientoFondo.update({ where: { id: m.id }, data: { monto: dec("4729813.4128") } });
    });
    expect(error).toMatch(/monto del ajuste/);
  });
});

describe("solo inserción", () => {
  it("un movimiento del fondo no se edita ni se borra", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const m = await constitucion(tx);
      await tx.movimientoFondo.update({ where: { id: m.id }, data: { fuente: "MANUAL" } });
    })).toMatch(/solo inserción/);
    expect(await enTransaccionDeshecha(async (tx) => {
      const m = await constitucion(tx);
      await tx.movimientoFondo.delete({ where: { id: m.id } });
    })).toMatch(/solo inserción/);
  });

  it("un ajuste de caja no se edita ni se borra", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const a = await ajuste(tx);
      await tx.ajusteCaja.update({ where: { id: a.id }, data: { motivo: "otro motivo ficticio" } });
    })).toMatch(/solo inserción/);
    expect(await enTransaccionDeshecha(async (tx) => {
      const a = await ajuste(tx);
      await tx.ajusteCaja.delete({ where: { id: a.id } });
    })).toMatch(/solo inserción/);
  });

  it("con la salida de reversión, el ajuste suelto sí se borra", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const a = await ajuste(tx);
      await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
      await tx.ajusteCaja.delete({ where: { id: a.id } });
    })).toBeNull();
  });
});
