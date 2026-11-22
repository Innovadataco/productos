// Constitución del fondo (frente fondo-movimientos, T3 y T4) contra la base de PRUEBAS:
// - registrarConstitucion escribe en UNA transacción el ajuste de caja (−monto, APORTE_FIC, EXTRACTO, el dueño como
//   autor) y la CONSTITUCION enlazada, de la misma fecha; sin `aplicar` es ensayo y no escribe;
// - idempotente, una sola por fondo, y se niega (sin escribir) si el monto no cuadra con unidades × valor de unidad
//   del MISMO día o si falta ese valor;
// - de punta a punta con la conciliación: el fondo deja «fondo_sin_unidades» y cuadra, y el efectivo deja
//   «aporte_fic_sin_registrar», con la diferencia (real − esperado) exactamente +monto.
// Las filas no se pueden borrar (solo inserción): cada caso usa su propio fondo, y scripts/integracion.mjs resetea la
// base de pruebas en cada corrida (no se acumulan). Cifras y fechas inventadas (2027).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { ErrorMovimientoFondo, MOTIVO_CONSTITUCION, registrarConstitucion, type ConstitucionValida } from "@/fondo/movimiento";
import { importarCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-5);
let n = 0;
const dec = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

const FECHA = dia("2027-08-17");
const UNIDADES = "1031.77246";
const VALOR_UNIDAD = "4584.13617";
const MONTO = "4729785.4531";
let email = "";
let duenoId = "";

const nuevoCodigo = () => `8${corrida}${String((n += 1)).padStart(2, "0")}`;

async function nuevoFondo(opciones: { activo?: boolean; valorUnidad?: string | null } = {}): Promise<{ id: string; codigo: string }> {
  const codigo = nuevoCodigo();
  const { id } = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: codigo, nombre: "Fondo ficticio de constitución", activo: opciones.activo ?? true }, select: { id: true } });
  const vu = opciones.valorUnidad === undefined ? VALOR_UNIDAD : opciones.valorUnidad;
  if (vu !== null) await db.valorUnidadFondo.create({ data: { fondoId: id, fechaValor: FECHA, valorUnidad: dec(vu) } });
  return { id, codigo };
}

const datos = (codigoFic: string, cambio: Partial<ConstitucionValida> = {}): ConstitucionValida => ({ email, codigoFic, fecha: FECHA, unidades: UNIDADES, monto: MONTO, ...cambio });

async function rechazo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ErrorMovimientoFondo) return e.codigo;
    throw e;
  }
  throw new Error("se esperaba un rechazo");
}

const escritoDe = async (fondoId: string) => ({
  movimientos: await db.movimientoFondo.count({ where: { fondoId } }),
  ajustes: await db.ajusteCaja.count({ where: { movimientoFondo: { fondoId } } }),
});

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  email = `dueno-constitucion-${corrida}@ejemplo.invalid`;
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registrarConstitucion", () => {
  it("el ensayo dice que cuadra y no escribe nada", async () => {
    const f = await nuevoFondo();
    const antesAjustes = await db.ajusteCaja.count();
    expect(await registrarConstitucion(db, datos(f.codigo), { aplicar: false })).toEqual({ estado: "ENSAYO", fondoId: f.id, movimientoId: null, ajusteId: null });
    expect(await escritoDe(f.id)).toEqual({ movimientos: 0, ajustes: 0 });
    expect(await db.ajusteCaja.count()).toBe(antesAjustes);
  });

  it("aplicar crea el ajuste −monto APORTE_FIC y la constitución enlazada, de la misma fecha y con el dueño como autor", async () => {
    const f = await nuevoFondo();
    const r = await registrarConstitucion(db, datos(f.codigo), { aplicar: true });
    expect(r).toMatchObject({ estado: "REGISTRADA", fondoId: f.id });
    const m = await db.movimientoFondo.findUniqueOrThrow({ where: { id: r.movimientoId! }, include: { ajusteCaja: true } });
    expect([m.fondoId, m.tipo, m.fuente, m.fecha.toISOString(), m.unidades.toString(), m.monto?.toString(), m.ajusteCajaId]).toEqual([
      f.id, "CONSTITUCION", "EXTRACTO", FECHA.toISOString(), UNIDADES, MONTO, r.ajusteId,
    ]);
    const a = m.ajusteCaja!;
    expect([a.fecha.toISOString(), a.monto.toString(), a.categoria, a.fuente, a.motivo, a.referenciaEvidencia, a.creadoPorId, a.eventoId]).toEqual([
      FECHA.toISOString(), `-${MONTO}`, "APORTE_FIC", "EXTRACTO", MOTIVO_CONSTITUCION, null, duenoId, null,
    ]);
  });

  it("repetir con los mismos datos (con o sin aplicar) da YA_EXISTIA y no duplica", async () => {
    const f = await nuevoFondo();
    const primera = await registrarConstitucion(db, datos(f.codigo), { aplicar: true });
    for (const aplicar of [true, false]) {
      expect(await registrarConstitucion(db, datos(f.codigo, { unidades: "1031.772460", monto: "4729785.45310" }), { aplicar })).toEqual({
        estado: "YA_EXISTIA", fondoId: f.id, movimientoId: primera.movimientoId, ajusteId: primera.ajusteId,
      });
    }
    expect(await escritoDe(f.id)).toEqual({ movimientos: 1, ajustes: 1 });
  });

  it("otra constitución del mismo fondo (otro día, otras unidades u otro monto): CONSTITUCION_DISTINTA, sin escribir", async () => {
    const f = await nuevoFondo();
    await registrarConstitucion(db, datos(f.codigo), { aplicar: true });
    for (const cambio of [{ fecha: dia("2027-08-18") }, { unidades: "1031.77247" }, { monto: "4729785.4532" }]) {
      expect(await rechazo(registrarConstitucion(db, datos(f.codigo, cambio), { aplicar: true }))).toBe("CONSTITUCION_DISTINTA");
    }
    expect(await escritoDe(f.id)).toEqual({ movimientos: 1, ajustes: 1 });
  });

  it("dos registros a la vez dejan una sola constitución", async () => {
    const f = await nuevoFondo();
    const rs = await Promise.all([1, 2, 3].map(() => registrarConstitucion(db, datos(f.codigo), { aplicar: true })));
    expect(rs.map((r) => r.estado).sort()).toEqual(["REGISTRADA", "YA_EXISTIA", "YA_EXISTIA"]);
    expect(await escritoDe(f.id)).toEqual({ movimientos: 1, ajustes: 1 });
  });

  it("sin el valor de unidad del día exacto (no vale el del día anterior ni uno reemplazado): SIN_VALOR_UNIDAD_DEL_DIA", async () => {
    const f = await nuevoFondo({ valorUnidad: null });
    await db.valorUnidadFondo.create({ data: { fondoId: f.id, fechaValor: dia("2027-08-16"), valorUnidad: dec(VALOR_UNIDAD) } });
    await db.valorUnidadFondo.create({ data: { fondoId: f.id, fechaValor: FECHA, valorUnidad: dec(VALOR_UNIDAD), reemplazadoEn: new Date() } });
    for (const aplicar of [false, true]) {
      expect(await rechazo(registrarConstitucion(db, datos(f.codigo), { aplicar }))).toBe("SIN_VALOR_UNIDAD_DEL_DIA");
    }
    expect(await escritoDe(f.id)).toEqual({ movimientos: 0, ajustes: 0 });
  });

  it("un monto fuera de ±0,5 % de unidades × valor de unidad: MONTO_NO_CUADRA_CON_VALOR_UNIDAD, sin escribir", async () => {
    const f = await nuevoFondo();
    for (const aplicar of [false, true]) {
      expect(await rechazo(registrarConstitucion(db, datos(f.codigo, { monto: "4760000.1373" }), { aplicar }))).toBe("MONTO_NO_CUADRA_CON_VALOR_UNIDAD");
    }
    expect(await escritoDe(f.id)).toEqual({ movimientos: 0, ajustes: 0 });
  });

  it("un fondo que no está registrado, que no es FIC o que está inactivo se rechaza", async () => {
    expect(await rechazo(registrarConstitucion(db, datos(nuevoCodigo()), { aplicar: true }))).toBe("FONDO_NO_REGISTRADO");
    const codigoDeAccion = nuevoCodigo();
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICTMF${corrida}`, codigoFic: codigoDeAccion, nombre: "Acción ficticia" } });
    expect(await rechazo(registrarConstitucion(db, datos(codigoDeAccion), { aplicar: true }))).toBe("FONDO_NO_REGISTRADO");
    const inactivo = await nuevoFondo({ activo: false });
    expect(await rechazo(registrarConstitucion(db, datos(inactivo.codigo), { aplicar: true }))).toBe("FONDO_INACTIVO");
  });

  it("un correo que no es de un dueño activo: USUARIO_NO_AUTORIZADO, sin escribir", async () => {
    const f = await nuevoFondo();
    const familia = `familia-constitucion-${corrida}@ejemplo.invalid`;
    const inactivo = `inactivo-constitucion-${corrida}@ejemplo.invalid`;
    await db.usuario.create({ data: { email: familia, rol: "FAMILIA" } });
    await db.usuario.create({ data: { email: inactivo, rol: "DUENO", activo: false } });
    for (const correo of [familia, inactivo, `nadie-constitucion-${corrida}@ejemplo.invalid`]) {
      expect(await rechazo(registrarConstitucion(db, datos(f.codigo, { email: correo }), { aplicar: true }))).toBe("USUARIO_NO_AUTORIZADO");
    }
    expect(await escritoDe(f.id)).toEqual({ movimientos: 0, ajustes: 0 });
  });

  it("con un movimiento del fondo anterior a la constitución: MOVIMIENTO_ANTES_DE_LA_CONSTITUCION", async () => {
    const f = await nuevoFondo();
    await db.movimientoFondo.create({ data: { fondoId: f.id, fecha: dia("2027-08-09"), unidades: dec("3.14159"), tipo: "AJUSTE", fuente: "MANUAL" } });
    expect(await rechazo(registrarConstitucion(db, datos(f.codigo), { aplicar: true }))).toBe("MOVIMIENTO_ANTES_DE_LA_CONSTITUCION");
    expect(await db.movimientoFondo.count({ where: { fondoId: f.id, tipo: "CONSTITUCION" } })).toBe(0);
  });
});

describe("de punta a punta con la conciliación", () => {
  // Jueves hábiles de la BVC de 2027 que no usa ningún otro archivo (la certificación es única por corte).
  const CORTE_ANTES = dia("2027-08-12");
  const CORTE = dia("2027-08-19");
  const SALDO_FONDO = "4781937.29";
  const VALOR_UNIDAD_CORTE = "4634.68204";
  const DIA = 86_400_000;

  async function certificar(corte: Date, nit: string, codigo: string | undefined) {
    const espec = {
      ...CERTIFICACION_FICTICIA,
      fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit, saldo: "COP 4.781.937,29" }],
      creadoEn: `D:${new Date(corte.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
    };
    const r = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: corte, fondoCodigo: codigo, hoy: new Date(corte.getTime() + 2 * DIA) });
    expect(r.errores).toEqual([]);
  }

  async function controles(corte: Date, fondoId: string) {
    const { conciliacionId } = await conciliarCertificacion(db, { fechaCorte: corte });
    const cs = await db.controlConciliacion.findMany({ where: { conciliacionId, OR: [{ tipo: "EFECTIVO" }, { tipo: "FONDO", instrumentoId: fondoId }] } });
    return { fondo: cs.find((c) => c.tipo === "FONDO")!, efectivo: cs.find((c) => c.tipo === "EFECTIVO")! };
  }

  it("el fondo deja fondo_sin_unidades y cuadra; el efectivo deja aporte_fic_sin_registrar y su diferencia sube exactamente el monto; un corte anterior a la constitución no la cuenta", async () => {
    const f = await nuevoFondo();
    await db.valorUnidadFondo.create({ data: { fondoId: f.id, fechaValor: CORTE, valorUnidad: dec(VALOR_UNIDAD_CORTE) } });
    await db.valorUnidadFondo.create({ data: { fondoId: f.id, fechaValor: CORTE_ANTES, valorUnidad: dec(VALOR_UNIDAD_CORTE) } });
    const nit = `99702${corrida}-3`;
    await certificar(CORTE, nit, f.codigo);
    await certificar(CORTE_ANTES, nit, undefined);

    const antes = await controles(CORTE, f.id);
    expect([antes.fondo.resultado, antes.fondo.codigoMotivo, antes.fondo.real?.toString()]).toEqual(["NO_CUADRA", "fondo_sin_unidades", SALDO_FONDO]);
    expect([antes.efectivo.resultado, antes.efectivo.codigoMotivo]).toEqual(["NO_CUADRA", "aporte_fic_sin_registrar"]);

    expect((await registrarConstitucion(db, datos(f.codigo), { aplicar: true })).estado).toBe("REGISTRADA");

    const despues = await controles(CORTE, f.id);
    expect([despues.fondo.resultado, despues.fondo.codigoMotivo]).toEqual(["CUADRA", null]);
    expect(despues.fondo.esperado!.toString()).toBe(dec(UNIDADES).mul(VALOR_UNIDAD_CORTE).toDecimalPlaces(6).toString());
    expect(despues.efectivo.codigoMotivo).not.toBe("aporte_fic_sin_registrar");
    expect(despues.efectivo.diferencia!.sub(antes.efectivo.diferencia!).toString()).toBe(MONTO);

    const anterior = await controles(CORTE_ANTES, f.id);
    expect([anterior.fondo.codigoMotivo, anterior.efectivo.codigoMotivo]).toEqual(["fondo_sin_unidades", "aporte_fic_sin_registrar"]);
  });
});
