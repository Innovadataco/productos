// Endurecimiento de la base (database-reviewer, hallazgos bajos) contra la base de PRUEBAS:
// - toda FK es ON DELETE RESTRICT ON UPDATE RESTRICT (antes, SET NULL y ON UPDATE CASCADE en la inicial);
// - toda FK tiene un índice que empieza por sus columnas;
// - CHECK de defensa en profundidad (NOT VALID: protegen las filas nuevas sin revisar las existentes).
// Cada caso de datos corre en una transacción que se deshace: no deja filas. Datos inventados.
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

const usuario = (tx: Tx) => tx.usuario.create({ data: { email: `reglas-esquema-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
const accion = (tx: Tx) => tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICT${unico()}`, nombre: "Acción ficticia" } });
const fondo = (tx: Tx) => tx.instrumento.create({ data: { tipo: "FIC", codigoFic: `FIC${unico()}`, nombre: "Fondo ficticio" } });

async function filaFuente(tx: Tx, tipoFuente: "TRII_ORDENES" | "TRII_DIVIDENDOS") {
  const u = await usuario(tx);
  const carga = await tx.cargaArchivo.create({
    data: { tipoFuente, nombreArchivo: "x.ficticio.csv", sha256: "e".repeat(64), estado: "CARGADO", cargadoPorId: u.id },
  });
  return tx.filaFuente.create({
    data: { tipoFuente, claveNatural: unico().padStart(64, "0"), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: { ficticio: true } },
  });
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("llaves foráneas", () => {
  it("toda FK del esquema es ON DELETE RESTRICT ON UPDATE RESTRICT", async () => {
    const distintas = await db.$queryRaw<{ fk: string }[]>`
      SELECT conname AS fk FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND (confdeltype <> 'r' OR confupdtype <> 'r')
      ORDER BY 1`;
    expect(distintas.map((d) => d.fk)).toEqual([]);
  });

  it("toda FK tiene un índice que empieza por sus columnas", async () => {
    const sinIndice = await db.$queryRaw<{ fk: string }[]>`
      SELECT c.conname AS fk FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
      ORDER BY 1`;
    expect(sinIndice.map((d) => d.fk)).toEqual([]);
  });

  it("borrar una especie citada por un control de conciliación falla (antes quedaba el control sin especie)", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const carga = await tx.cargaArchivo.create({
        data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "c.ficticio.pdf", sha256: "f".repeat(64), estado: "CARGADO", cargadoPorId: u.id },
      });
      const cert = await tx.certificacion.create({ data: { cargaId: carga.id, fechaCorte: new Date("2099-01-31"), saldoEfectivo: dec("1") } });
      const conc = await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: cert.fechaCorte, versionCalculo: "ficticia", resultado: "CUADRA" } });
      const especie = await accion(tx);
      await tx.controlConciliacion.create({ data: { conciliacionId: conc.id, tipo: "CANTIDAD", instrumentoId: especie.id, resultado: "CUADRA" } });
      await tx.instrumento.delete({ where: { id: especie.id } });
    });
    expect(error).toMatch(/control_conciliacion_instrumentoId_fkey|Foreign key constraint/);
  });

  it("borrar un ajuste de caja citado por un movimiento del fondo falla (antes el movimiento perdía su ajuste)", async () => {
    const error = await enTransaccionDeshecha(async (tx) => {
      const u = await usuario(tx);
      const ajuste = await tx.ajusteCaja.create({
        data: { fecha: new Date("2099-02-01"), monto: dec("-10"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "ficticio", creadoPorId: u.id },
      });
      const fic = await fondo(tx);
      await tx.movimientoFondo.create({ data: { fondoId: fic.id, fecha: ajuste.fecha, unidades: dec("1"), tipo: "APORTE", fuente: "MANUAL", ajusteCajaId: ajuste.id } });
      await tx.ajusteCaja.delete({ where: { id: ajuste.id } });
    });
    expect(error).toMatch(/movimiento_fondo_ajusteCajaId_fkey|Foreign key constraint/);
  });
});

describe("CHECK de defensa en profundidad (NOT VALID)", () => {
  async function evento(tx: Tx, mismo: boolean, razon: string | null) {
    const origen = await accion(tx);
    const destino = mismo ? origen : await accion(tx);
    await tx.eventoCorporativo.create({
      data: { tipo: "ESCISION", fecha: new Date("2099-03-01"), origenId: origen.id, destinoId: destino.id, razon: razon === null ? null : dec(razon) },
    });
  }

  it("un evento corporativo no tiene la misma especie de origen y destino", async () => {
    expect(await enTransaccionDeshecha((tx) => evento(tx, true, "0.5"))).toMatch(/evento_corporativo_origen_destino_chk/);
    expect(await enTransaccionDeshecha((tx) => evento(tx, false, "0.5"))).toBeNull();
  });

  it("la razón de un evento, si la hay, es positiva", async () => {
    expect(await enTransaccionDeshecha((tx) => evento(tx, false, "0"))).toMatch(/evento_corporativo_razon_chk/);
    expect(await enTransaccionDeshecha((tx) => evento(tx, false, "-1"))).toMatch(/evento_corporativo_razon_chk/);
    expect(await enTransaccionDeshecha((tx) => evento(tx, false, null))).toBeNull();
  });

  async function dividendo(tx: Tx, montos: { bruto?: string; retencion?: string; tasa?: string }) {
    const fila = await filaFuente(tx, "TRII_DIVIDENDOS");
    const especie = await accion(tx);
    await tx.dividendo.create({
      data: {
        filaFuenteId: fila.id, fechaPago: new Date("2099-04-01"), instrumentoId: especie.id, tipo: "EXTRAORDINARIO", montoNeto: dec("100"),
        montoBruto: montos.bruto ? dec(montos.bruto) : null, retencion: montos.retencion ? dec(montos.retencion) : null,
        tasaRetencion: montos.tasa ? dec(montos.tasa) : null,
      },
    });
  }

  it("la retención de un dividendo no es negativa (aunque cuadre bruto − retención = neto)", async () => {
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "99", retencion: "-1" }))).toMatch(/dividendo_retencion_chk/);
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "100", retencion: "0" }))).toBeNull();
  });

  it("la tasa de retención es una fracción entre 0 y 1 (MODELO-DATOS: p. ej. 0.350000)", async () => {
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "154", retencion: "54", tasa: "35" }))).toMatch(/dividendo_tasa_retencion_chk/);
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "154", retencion: "54", tasa: "-0.1" }))).toMatch(/dividendo_tasa_retencion_chk/);
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "154", retencion: "54", tasa: "0.35" }))).toBeNull();
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { bruto: "100", retencion: "0", tasa: "0" }))).toBeNull();
    expect(await enTransaccionDeshecha((tx) => dividendo(tx, { tasa: "1" }))).toBeNull();
  });

  async function orden(tx: Tx, operacion: string, liquidacion: string) {
    const fila = await filaFuente(tx, "TRII_ORDENES");
    const especie = await accion(tx);
    await tx.orden.create({
      data: {
        filaFuenteId: fila.id, ejecutadaEn: new Date(`${operacion}T15:00:00Z`), fechaOperacion: new Date(operacion), fechaLiquidacion: new Date(liquidacion),
        instrumentoId: especie.id, lado: "COMPRA", estado: "APROBADO", cantidadCompletada: 1n, precioUnitario: dec("10"),
        totalInvertido: dec("10"), comision: dec("0"), totalEstimado: dec("10"),
      },
    });
  }

  it("una orden no se liquida antes de operarse", async () => {
    expect(await enTransaccionDeshecha((tx) => orden(tx, "2099-05-05", "2099-05-04"))).toMatch(/orden_fechas_chk/);
    expect(await enTransaccionDeshecha((tx) => orden(tx, "2099-05-05", "2099-05-05"))).toBeNull();
    expect(await enTransaccionDeshecha((tx) => orden(tx, "2099-05-05", "2099-05-07"))).toBeNull();
  });

  it("los CHECK nuevos nacen NOT VALID: no revisan las filas que ya existen", async () => {
    const filas = await db.$queryRaw<{ conname: string; convalidated: boolean }[]>`
      SELECT conname, convalidated FROM pg_constraint
      WHERE conname IN ('evento_corporativo_origen_destino_chk', 'evento_corporativo_razon_chk', 'dividendo_retencion_chk',
                        'dividendo_tasa_retencion_chk', 'orden_fechas_chk')
      ORDER BY 1`;
    expect(filas).toEqual([
      { conname: "dividendo_retencion_chk", convalidated: false },
      { conname: "dividendo_tasa_retencion_chk", convalidated: false },
      { conname: "evento_corporativo_origen_destino_chk", convalidated: false },
      { conname: "evento_corporativo_razon_chk", convalidated: false },
      { conname: "orden_fechas_chk", convalidated: false },
    ]);
  });
});
