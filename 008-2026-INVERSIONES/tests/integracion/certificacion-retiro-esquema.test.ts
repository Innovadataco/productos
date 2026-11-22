// Candados de la base para RETIRAR una certificación cargada con el corte equivocado (frente certificacion-corte-real),
// contra la base de PRUEBAS. El retiro es la única edición que admite la certificación y nunca borra historia:
// - certificacion: nace vigente; solo pasa una vez a retirada (retiradaEn + reemplazadaPorId, sin tocar nada más),
//   y solo si su reemplazo existe, está vigente, tiene otra fecha de corte y su carga CARGADO es del MISMO archivo;
// - CHECK: retiradaEn y reemplazadaPorId van juntos y nunca apuntan a sí misma;
// - sobre una certificación retirada no se insertan conciliaciones, posiciones ni fondos (con FOR SHARE: una
//   conciliación en REPEATABLE READ que tomó su instantánea antes del retiro no se cuela después);
// - carga_archivo: REVERTIDO solo desde CARGADO, con quién (un DUEÑO) y cuándo, sin tocar nada más, solo si ninguna
//   certificación vigente cuelga de ella, y es final.
// Cada caso corre en una transacción que se deshace, salvo la carrera. Datos inventados: diciembre de 2027.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const otra = new PrismaClient();
const corrida = Date.now().toString(36);
let n = 0;
const unico = () => `${corrida}-${(n += 1)}`;
const dec = (v: string) => new Prisma.Decimal(v);
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const SHA = "b7".repeat(32);
const OTRO_SHA = "c9".repeat(32);

type Tx = Prisma.TransactionClient;
class Deshacer extends Error {}

/** Corre `cuerpo` en una transacción que siempre se deshace; devuelve el mensaje del error que lanzó, o null. */
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

interface Par {
  readonly duenoId: string;
  readonly cargaVieja: string;
  readonly vieja: string;
  readonly cargaNueva: string;
  readonly nueva: string;
}

/** La certificación vieja (corte D) y su reemplazo (corte D'), cada una con su carga. */
async function par(tx: Tx, o: { shaNueva?: string; estadoNueva?: "CARGADO" | "VALIDANDO"; d?: string; dNueva?: string } = {}): Promise<Par> {
  const u = await tx.usuario.create({ data: { email: `retiro-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
  const carga = (sha256: string, fecha: string, estado: "CARGADO" | "VALIDANDO") =>
    tx.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: `certificacion-av-${fecha}.pdf`, sha256, fechaCorte: dia(fecha), estado, cargadoPorId: u.id } });
  const cv = await carga(SHA, o.d ?? "2027-12-10", "CARGADO");
  const v = await tx.certificacion.create({ data: { cargaId: cv.id, fechaCorte: dia(o.d ?? "2027-12-10"), saldoEfectivo: dec("4613.07") } });
  const cn = await carga(o.shaNueva ?? SHA, o.dNueva ?? "2027-12-09", o.estadoNueva ?? "CARGADO");
  const nv = await tx.certificacion.create({ data: { cargaId: cn.id, fechaCorte: dia(o.dNueva ?? "2027-12-09"), saldoEfectivo: dec("4613.07") } });
  return { duenoId: u.id, cargaVieja: cv.id, vieja: v.id, cargaNueva: cn.id, nueva: nv.id };
}

const retirar = (tx: Tx, p: Par, extra: Prisma.CertificacionUncheckedUpdateInput = {}) =>
  tx.certificacion.update({ where: { id: p.vieja }, data: { retiradaEn: new Date(), reemplazadaPorId: p.nueva, ...extra } });
const revertir = (tx: Tx, cargaId: string, duenoId: string | null, extra: Prisma.CargaArchivoUncheckedUpdateInput = {}) =>
  tx.cargaArchivo.update({ where: { id: cargaId }, data: { estado: "REVERTIDO", revertidaEn: new Date(), revertidaPorId: duenoId, ...extra } });
const abrirBypass = (tx: Tx) => tx.$executeRaw`SELECT set_config('inv.reversion', 'on', true)`;

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
  await otra.$disconnect();
});

describe("certificacion: el retiro es la única edición", () => {
  it("el retiro válido pasa (una vez, reemplazo vigente del mismo archivo con otra fecha) y después la carga vieja pasa a REVERTIDO", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const p = await par(tx);
        await retirar(tx, p);
        await revertir(tx, p.cargaVieja, p.duenoId);
        const vieja = await tx.certificacion.findUniqueOrThrow({ where: { id: p.vieja }, select: { reemplazadaPorId: true, retiradaEn: true } });
        expect(vieja.reemplazadaPorId).toBe(p.nueva);
        expect(vieja.retiradaEn).not.toBeNull();
      }),
    ).toBeNull();
  });

  it("no se retira cambiando otra columna a la vez", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await retirar(tx, await par(tx), { saldoEfectivo: dec("4613.08") })))).toMatch(/solo inserción/);
  });

  it("no se retira dos veces ni se cambia el reemplazo", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      const otro = await par(tx, { d: "2027-12-16", dNueva: "2027-12-15" });
      await tx.certificacion.update({ where: { id: p.vieja }, data: { retiradaEn: new Date(), reemplazadaPorId: otro.nueva } });
    });
    expect(error).toMatch(/solo inserción/);
  });

  it("el reemplazo debe ser del mismo archivo, tener su carga CARGADO y estar vigente", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await retirar(tx, await par(tx, { shaNueva: OTRO_SHA }))))).toMatch(/solo inserción/);
    expect(await enTransaccionDeshecha(async (tx) => void (await retirar(tx, await par(tx, { estadoNueva: "VALIDANDO" }))))).toMatch(/solo inserción/);
    const retirado = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      const otro = await par(tx, { d: "2027-12-16", dNueva: "2027-12-15" });
      // El reemplazo (p.nueva) se retira primero en favor de otra; después ya no puede reemplazar a nadie.
      await tx.certificacion.update({ where: { id: p.nueva }, data: { retiradaEn: new Date(), reemplazadaPorId: otro.nueva } });
      await retirar(tx, p);
    });
    expect(retirado).toMatch(/solo inserción/);
  });

  it("nace vigente: no se inserta ya retirada", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      const carga = await tx.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-av.pdf", sha256: SHA, estado: "CARGADO", cargadoPorId: p.duenoId } });
      await tx.certificacion.create({ data: { cargaId: carga.id, fechaCorte: dia("2027-12-21"), saldoEfectivo: dec("37.91"), retiradaEn: new Date(), reemplazadaPorId: p.nueva } });
    });
    expect(error).toMatch(/solo inserción/);
  });

  it("CHECK: retiradaEn y reemplazadaPorId van juntos y nunca a sí misma (aun con la reversión abierta)", async () => {
    const pareja = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await abrirBypass(tx);
      await tx.certificacion.update({ where: { id: p.vieja }, data: { retiradaEn: new Date() } });
    });
    expect(pareja).toMatch(/certificacion_retiro_chk/);
    const misma = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await abrirBypass(tx);
      await tx.certificacion.update({ where: { id: p.vieja }, data: { retiradaEn: new Date(), reemplazadaPorId: p.vieja } });
    });
    expect(misma).toMatch(/certificacion_retiro_chk/);
  });

  it("la certificación sigue sin borrarse", async () => {
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacion.delete({ where: { id: (await par(tx)).vieja } })))).toMatch(/solo inserción/);
  });
});

describe("sobre una certificación retirada no se inserta nada", () => {
  const sobreRetirada = (insertar: (tx: Tx, p: Par) => Promise<unknown>) =>
    enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      await insertar(tx, p);
    });

  it("ni conciliaciones, ni posiciones, ni fondos", async () => {
    const accion = (tx: Tx) => tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICR${unico()}`, nombre: "Acción ficticia" } });
    expect(await sobreRetirada((tx, p) => tx.conciliacion.create({ data: { certificacionId: p.vieja, fechaCorte: dia("2027-12-10"), versionCalculo: "conciliacion-v2", resultado: "NO_CUADRA" } }))).toMatch(/está retirada/);
    expect(
      await sobreRetirada(async (tx, p) => tx.certificacionPosicion.create({ data: { certificacionId: p.vieja, instrumentoId: (await accion(tx)).id, cantidad: 37n, precioValoracion: dec("46.13"), valorMercado: dec("1706.81") } })),
    ).toMatch(/está retirada/);
    expect(
      await sobreRetirada(async (tx, p) => {
        const fic = await tx.instrumento.create({ data: { tipo: "FIC", codigoFic: `FICR${unico()}`, nombre: "Fondo ficticio" } });
        return tx.certificacionFondo.create({ data: { certificacionId: p.vieja, instrumentoId: fic.id, encargo: "x", saldo: dec("613.29") } });
      }),
    ).toMatch(/está retirada/);
  });

  it("sobre la vigente sí (su reemplazo)", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const p = await par(tx);
        await retirar(tx, p);
        await tx.conciliacion.create({ data: { certificacionId: p.nueva, fechaCorte: dia("2027-12-09"), versionCalculo: "conciliacion-v2", resultado: "NO_CUADRA" } });
      }),
    ).toBeNull();
  });
});

describe("carga_archivo: REVERTIDO", () => {
  it("no pasa a REVERTIDO si su certificación sigue vigente", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await revertir(tx, p.cargaVieja, p.duenoId);
    });
    expect(error).toMatch(/REVERTIDO/);
  });

  it("exige quién (un DUEÑO) y cuándo, y no cambia nada más", async () => {
    const sinQuien = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      await revertir(tx, p.cargaVieja, null);
    });
    expect(sinQuien).toMatch(/REVERTIDO/);
    const familia = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      const f = await tx.usuario.create({ data: { email: `familia-${unico()}@ejemplo.invalid`, rol: "FAMILIA" } });
      await revertir(tx, p.cargaVieja, f.id);
    });
    expect(familia).toMatch(/REVERTIDO/);
    const otraColumna = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      await revertir(tx, p.cargaVieja, p.duenoId, { filasTotal: 41 });
    });
    expect(otraColumna).toMatch(/REVERTIDO/);
  });

  it("solo desde CARGADO, y es final", async () => {
    const desdeRechazada = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      const r = await tx.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-av.pdf", sha256: SHA, estado: "RECHAZADO", cargadoPorId: p.duenoId } });
      await revertir(tx, r.id, p.duenoId);
    });
    expect(desdeRechazada).toMatch(/REVERTIDO/);
    const vuelta = await enTransaccionDeshecha(async (tx) => {
      const p = await par(tx);
      await retirar(tx, p);
      await revertir(tx, p.cargaVieja, p.duenoId);
      await tx.cargaArchivo.update({ where: { id: p.cargaVieja }, data: { estado: "CARGADO" } });
    });
    expect(vuelta).toMatch(/REVERTIDO/);
  });

  it("revertidaEn y revertidaPorId solo con REVERTIDO", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const p = await par(tx);
        await tx.cargaArchivo.update({ where: { id: p.cargaNueva }, data: { revertidaEn: new Date(), revertidaPorId: p.duenoId } });
      }),
    ).toMatch(/REVERTIDO/);
  });

  it("las demás actualizaciones de una carga siguen igual (VALIDANDO → CARGADO con sus conteos)", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const p = await par(tx, { estadoNueva: "VALIDANDO" });
        await tx.cargaArchivo.update({ where: { id: p.cargaNueva }, data: { estado: "CARGADO", filasTotal: 6, filasNuevas: 6, filasRepetidas: 0 } });
      }),
    ).toBeNull();
  });
});

describe("carrera con una conciliación en REPEATABLE READ", () => {
  it("una conciliación que tomó su instantánea antes del retiro no se inserta después (falla cerrado)", async () => {
    const p = await db.$transaction((tx) => par(tx, { d: "2027-12-02", dNueva: "2027-12-01" }));
    const resultado = db.$transaction(
      async (tx) => {
        // Instantánea con la certificación vigente.
        expect(await tx.certificacion.findUniqueOrThrow({ where: { id: p.vieja }, select: { retiradaEn: true } })).toEqual({ retiradaEn: null });
        // Otra conexión la retira y confirma mientras tanto.
        await otra.certificacion.update({ where: { id: p.vieja }, data: { retiradaEn: new Date(), reemplazadaPorId: p.nueva } });
        await tx.conciliacion.create({ data: { certificacionId: p.vieja, fechaCorte: dia("2027-12-02"), versionCalculo: "conciliacion-v2", resultado: "NO_CUADRA" } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 },
    );
    await expect(resultado).rejects.toThrow(/could not serialize|write conflict|P2034|está retirada/i);
    expect(await db.conciliacion.count({ where: { certificacionId: p.vieja } })).toBe(0);
  });
});
