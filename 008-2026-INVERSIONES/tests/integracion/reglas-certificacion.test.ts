// Reglas de la base para la certificación de A&V y su conciliación (PR-B del hito 1), contra la base de PRUEBAS:
// CHECK de valores y de referencias a filas del PDF, NIT del fondo, fecha de corte de la conciliación amarrada a la
// de su certificación, motivo obligatorio en los controles que no cuadran y solo inserción.
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

const FECHA = new Date("2099-03-31T00:00:00Z");

async function certificacion(tx: Tx) {
  const u = await tx.usuario.create({ data: { email: `reglas-cert-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
  const carga = await tx.cargaArchivo.create({
    data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-av.ficticio.pdf", sha256: "a".repeat(64), estado: "CARGADO", cargadoPorId: u.id },
  });
  return tx.certificacion.create({ data: { cargaId: carga.id, fechaCorte: FECHA, saldoEfectivo: dec("1"), referenciaEfectivo: "p2:f6" } });
}
const accion = (tx: Tx) => tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICT${unico()}`, nombre: "Acción ficticia" } });
const fondo = (tx: Tx, nitFondo: string | null = null) =>
  tx.instrumento.create({ data: { tipo: "FIC", codigoFic: `FIC${unico()}`, nombre: "Fondo ficticio", nitFondo } });

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("certificación: valores y referencias a filas del PDF", () => {
  const posicion = (cantidad: bigint, precio: string, valor: string, referenciaPdf: string | null = "p1:f2") => async (tx: Tx) => {
    const cert = await certificacion(tx);
    const especie = await accion(tx);
    await tx.certificacionPosicion.create({
      data: { certificacionId: cert.id, instrumentoId: especie.id, cantidad, precioValoracion: dec(precio), valorMercado: dec(valor), referenciaPdf },
    });
  };

  it("acepta una posición válida, con la valoración en 0 y varias filas en la referencia", async () => {
    expect(await enTransaccionDeshecha(posicion(10n, "0", "0", "p1:f2,p1:f3,p2:f1"))).toBeNull();
  });

  it("rechaza cantidad 0, valoración o valor negativos", async () => {
    expect(await enTransaccionDeshecha(posicion(0n, "1", "0"))).toMatch(/certificacion_posicion_valores_chk/);
    expect(await enTransaccionDeshecha(posicion(1n, "-1", "0"))).toMatch(/certificacion_posicion_valores_chk/);
    expect(await enTransaccionDeshecha(posicion(1n, "1", "-1"))).toMatch(/certificacion_posicion_valores_chk/);
  });

  it("rechaza una referencia que no es «p<n>:f<n>» (nunca texto de la celda)", async () => {
    expect(await enTransaccionDeshecha(posicion(1n, "1", "1", "FICT1 fila 2"))).toMatch(/certificacion_posicion_referencia_chk/);
    expect(await enTransaccionDeshecha(posicion(1n, "1", "1", "p1:f2,"))).toMatch(/certificacion_posicion_referencia_chk/);
  });

  it("rechaza la referencia del efectivo y la del fondo con otra forma", async () => {
    const efectivo = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      await tx.$executeRaw`UPDATE certificacion SET "referenciaEfectivo" = 'p2' WHERE id = ${cert.id}`;
    });
    expect(efectivo).toMatch(/certificacion_referencia_efectivo_chk|solo inserción/);
    const enFondo = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      const fic = await fondo(tx);
      await tx.certificacionFondo.create({ data: { certificacionId: cert.id, instrumentoId: fic.id, encargo: "{}", saldo: dec("1"), referenciaPdf: "p1:f1,p1:f2" } });
    });
    expect(enFondo).toMatch(/certificacion_fondo_referencia_chk/);
  });

  it("rechaza un fondo con saldo negativo o con unidades en 0", async () => {
    for (const [saldo, unidades] of [["-1", null], ["1", "0"]] as const) {
      const error = await enTransaccionDeshecha(async (tx) => {
        const cert = await certificacion(tx);
        const fic = await fondo(tx);
        await tx.certificacionFondo.create({
          data: { certificacionId: cert.id, instrumentoId: fic.id, encargo: "{}", saldo: dec(saldo), unidades: unidades === null ? null : dec(unidades) },
        });
      });
      expect(error).toMatch(/certificacion_fondo_valores_chk/);
    }
  });
});

describe("instrumento: NIT del fondo", () => {
  it("acepta el NIT en un FIC y rechaza un NIT repetido", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      await fondo(tx, "999000111-0");
      await tx.instrumento.create({ data: { tipo: "FIC", codigoFic: `FIC${unico()}`, nombre: "Otro fondo ficticio", nitFondo: "999000111-0" } });
    });
    expect(error).toMatch(/Unique constraint failed on the fields: \(`nitFondo`\)/);
  });

  it("rechaza un NIT en una acción o con otra forma", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        await tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICT${unico()}`, nombre: "Acción ficticia", nitFondo: "999000111-0" } });
      }),
    ).toMatch(/instrumento_nit_fondo_chk/);
    expect(await enTransaccionDeshecha(async (tx) => void (await fondo(tx, "999000111")))).toMatch(/instrumento_nit_fondo_chk/);
  });
});

describe("conciliación: fecha de corte de su certificación y motivo en cada control", () => {
  it("rechaza una conciliación con otra fecha de corte que la de su certificación", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: new Date("2099-04-01"), versionCalculo: "ficticia", resultado: "CUADRA" } });
    });
    expect(error).toMatch(/conciliacion_certificacionId_fechaCorte_fkey|Foreign key constraint/);
  });

  const control = (datos: Partial<Prisma.ControlConciliacionUncheckedCreateInput>) => async (tx: Tx) => {
    const cert = await certificacion(tx);
    const conc = await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: FECHA, versionCalculo: "ficticia", resultado: "NO_CUADRA" } });
    await tx.controlConciliacion.create({ data: { conciliacionId: conc.id, tipo: "CANTIDAD", resultado: "CUADRA", ...datos } });
  };

  it("acepta un control que cuadra sin motivo y uno que no cuadra con su código", async () => {
    expect(await enTransaccionDeshecha(control({}))).toBeNull();
    expect(await enTransaccionDeshecha(control({ resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte" }))).toBeNull();
  });

  it("rechaza un control que no cuadra sin motivo, o con un motivo que no es un código", async () => {
    expect(await enTransaccionDeshecha(control({ resultado: "NO_CUADRA" }))).toMatch(/control_conciliacion_motivo_chk/);
    expect(await enTransaccionDeshecha(control({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "T+2 por liquidar" }))).toMatch(/control_conciliacion_motivo_chk/);
  });

  it("rechaza una tolerancia negativa", async () => {
    expect(await enTransaccionDeshecha(control({ tolerancia: dec("-0.005") }))).toMatch(/control_conciliacion_tolerancia_chk/);
  });
});

describe("solo inserción: certificación y conciliación", () => {
  it("la certificación no se edita ni se borra", async () => {
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const cert = await certificacion(tx);
        await tx.certificacion.update({ where: { id: cert.id }, data: { saldoEfectivo: dec("2") } });
      }),
    ).toMatch(/solo inserción/);
    expect(
      await enTransaccionDeshecha(async (tx) => {
        const cert = await certificacion(tx);
        await tx.certificacion.delete({ where: { id: cert.id } });
      }),
    ).toMatch(/solo inserción/);
  });

  it("la posición certificada no se edita ni se borra (database-reviewer ALTO: la conciliación guardada debe poder reproducirse)", async () => {
    const preparar = async (tx: Tx) => {
      const cert = await certificacion(tx);
      const especie = await accion(tx);
      return tx.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId: especie.id, cantidad: 10n, precioValoracion: dec("5"), valorMercado: dec("50"), referenciaPdf: "p1:f2" } });
    };
    const llave = (p: { certificacionId: string; instrumentoId: string }) => ({ certificacionId_instrumentoId: { certificacionId: p.certificacionId, instrumentoId: p.instrumentoId } });
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacionPosicion.update({ where: llave(await preparar(tx)), data: { cantidad: 11n } })))).toMatch(/solo inserción/);
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacionPosicion.delete({ where: llave(await preparar(tx)) })))).toMatch(/solo inserción/);
  });

  it("la conciliación y sus controles no se editan ni se borran", async () => {
    const enConciliacion = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      const conc = await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: FECHA, versionCalculo: "ficticia", resultado: "CUADRA" } });
      await tx.conciliacion.update({ where: { id: conc.id }, data: { resultado: "NO_CUADRA" } });
    });
    expect(enConciliacion).toMatch(/solo inserción/);
    const enControl = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      const conc = await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: FECHA, versionCalculo: "ficticia", resultado: "CUADRA" } });
      const c = await tx.controlConciliacion.create({ data: { conciliacionId: conc.id, tipo: "VALOR", resultado: "CUADRA" } });
      await tx.controlConciliacion.delete({ where: { id: c.id } });
    });
    expect(enControl).toMatch(/solo inserción/);
  });

  it("del fondo certificado solo se puede reescribir el encargo (re-cifrado); el saldo no, y no se borra", async () => {
    const preparar = async (tx: Tx) => {
      const cert = await certificacion(tx);
      const fic = await fondo(tx);
      return tx.certificacionFondo.create({ data: { certificacionId: cert.id, instrumentoId: fic.id, encargo: "{}", saldo: dec("5"), referenciaPdf: "p1:f1" } });
    };
    const llave = (f: { certificacionId: string; instrumentoId: string }) => ({ certificacionId_instrumentoId: { certificacionId: f.certificacionId, instrumentoId: f.instrumentoId } });
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacionFondo.update({ where: llave(await preparar(tx)), data: { encargo: "{\"v\":1}" } })))).toBeNull();
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacionFondo.update({ where: llave(await preparar(tx)), data: { saldo: dec("6") } })))).toMatch(/solo inserción/);
    expect(await enTransaccionDeshecha(async (tx) => void (await tx.certificacionFondo.delete({ where: llave(await preparar(tx)) })))).toMatch(/solo inserción/);
  });

  it("con la reversión abierta (SET LOCAL inv.reversion) sí se puede borrar", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const cert = await certificacion(tx);
      const fic = await fondo(tx);
      const f = await tx.certificacionFondo.create({ data: { certificacionId: cert.id, instrumentoId: fic.id, encargo: "{}", saldo: dec("5") } });
      await tx.$executeRaw`SELECT set_config('inv.reversion', 'on', true)`;
      await tx.certificacionFondo.delete({ where: { certificacionId_instrumentoId: { certificacionId: f.certificacionId, instrumentoId: f.instrumentoId } } });
      await tx.certificacion.delete({ where: { id: cert.id } });
    });
    expect(error).toBeNull();
  });
});
