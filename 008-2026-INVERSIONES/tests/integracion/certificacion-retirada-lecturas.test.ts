// Una certificación RETIRADA (corte equivocado, reemplazada por la de su corte real) deja de contar para todo lo que
// lee «la certificación de una fecha» (frente certificacion-corte-real), contra la base de PRUEBAS:
// - conciliar su fecha da CERTIFICACION_RETIRADA y dice la fecha del reemplazo (no concilia sobre ella);
// - la pantalla y el tablero no la ofrecen ni la toman por la más reciente; su lectura da null;
// - otra certificación con su fecha se rechaza con CORTE_RETIRADO (la fecha queda ocupada por la historia); el
//   mismo PDF, con ARCHIVO_YA_CARGADO;
// - los cierres de su fecha quedan sin referencia; los de la fecha del reemplazo se verifican contra él.
// La retirada se arma directo en la base (el retiro mismo lo prueban certificacion-retiro-esquema y
// corregir-corte-certificacion). Datos inventados: junio de 2027 (importación con `hoy` inyectado) y, para «la más
// reciente», 2035 (sin calendario: solo filas directas, sin importar).
import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion, ErrorConciliacion } from "@/conciliacion/conciliar";
import { cortesDisponibles, leerConciliacion, ultimaConciliacion } from "@/conciliacion/leer";
import { importarCertificacion } from "@/importacion/av/importar";
import { guardarCierresDeEspecies } from "@/precios/guardar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const dec = (v: string) => new Prisma.Decimal(v);
let duenoId = "";

const PDF: EspecCertificacion = {
  ...CERTIFICACION_FICTICIA,
  fondos: [],
  rentaVariable: [{ nemo: `T${corrida}A`, cantidad: "41", precio: "COP 2.371,00", valor: "COP 97.211,00" }],
  creadoEn: "D:20270616101913-05'00'",
};
const sha = (e: EspecCertificacion) => createHash("sha256").update(generarCertificacionPdf(e)).digest("hex");

/** Retirada en `d` reemplazada por la de `dNueva`, del mismo archivo (sha256), con una posición de valoración cada una. */
async function retirada(d: string, dNueva: string, sha256: string, instrumentoId: string | null = null) {
  const carga = (fecha: string) =>
    db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: `certificacion-av-${fecha}.pdf`, sha256, fechaCorte: dia(fecha), estado: "CARGADO", cargadoPorId: duenoId } });
  const cv = await carga(d);
  const vieja = await db.certificacion.create({ data: { cargaId: cv.id, fechaCorte: dia(d), saldoEfectivo: dec("613.29") } });
  const cn = await carga(dNueva);
  const nueva = await db.certificacion.create({ data: { cargaId: cn.id, fechaCorte: dia(dNueva), saldoEfectivo: dec("613.29") } });
  if (instrumentoId !== null) {
    for (const c of [vieja, nueva]) await db.certificacionPosicion.create({ data: { certificacionId: c.id, instrumentoId, cantidad: 41n, precioValoracion: dec("2371"), valorMercado: dec("97211") } });
  }
  await db.conciliacion.create({ data: { certificacionId: vieja.id, fechaCorte: dia(d), versionCalculo: "conciliacion-v2", resultado: "NO_CUADRA" } });
  await db.certificacion.update({ where: { id: vieja.id }, data: { retiradaEn: new Date(), reemplazadaPorId: nueva.id } });
  await db.cargaArchivo.update({ where: { id: cv.id }, data: { estado: "REVERTIDO", revertidaEn: new Date(), revertidaPorId: duenoId } });
  return { vieja, nueva };
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-retirada-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("una certificación retirada no cuenta como la de su fecha", () => {
  it("conciliar su fecha: CERTIFICACION_RETIRADA con la fecha del reemplazo, sin conciliación nueva", async () => {
    const { vieja } = await retirada("2027-06-22", "2027-06-21", "d1".repeat(32));
    const error = await conciliarCertificacion(db, { fechaCorte: dia("2027-06-22") }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorConciliacion);
    expect(error).toMatchObject({ codigo: "CERTIFICACION_RETIRADA", reemplazo: "2027-06-21" });
    expect(await db.conciliacion.count({ where: { certificacionId: vieja.id } })).toBe(1);
    await expect(conciliarCertificacion(db, { fechaCorte: dia("2027-06-21") })).resolves.toMatchObject({ fechaCorte: "2027-06-21" });
  });

  it("la pantalla y el tablero: no la ofrecen, no es la más reciente y su lectura es null", async () => {
    await retirada("2035-03-14", "2035-03-13", "d2".repeat(32));
    const cortes = (await cortesDisponibles(db)).map((c) => c.fechaCorte.toISOString().slice(0, 10));
    expect(cortes).not.toContain("2035-03-14");
    expect(cortes).toContain("2035-03-13");
    expect((await ultimaConciliacion(db))?.fechaCorte).toEqual(dia("2035-03-13"));
    expect(await leerConciliacion(db, dia("2035-03-14"))).toBeNull();
    expect(await leerConciliacion(db, dia("2035-03-13"))).not.toBeNull();
  });

  it("importar en su fecha: otro PDF da CORTE_RETIRADO; el mismo PDF, ARCHIVO_YA_CARGADO", async () => {
    await retirada("2027-06-15", "2027-06-14", sha(PDF));
    const hoy = dia("2027-06-18");
    const mismo = await importarCertificacion(db, { contenido: generarCertificacionPdf(PDF), usuarioId: duenoId, fechaCorte: dia("2027-06-15"), hoy });
    expect(mismo.errores.map((e) => e.codigo)).toEqual(["ARCHIVO_YA_CARGADO"]);
    const otro: EspecCertificacion = { ...PDF, rentaVariable: [{ ...PDF.rentaVariable[0]!, cantidad: "43", valor: "COP 101.953,00" }] };
    const r = await importarCertificacion(db, { contenido: generarCertificacionPdf(otro), usuarioId: duenoId, fechaCorte: dia("2027-06-15"), hoy });
    expect(r.errores.map((e) => e.codigo)).toEqual(["CORTE_RETIRADO"]);
  });

  it("precios: los cierres de su fecha quedan sin referencia y los de la fecha del reemplazo se verifican contra él", async () => {
    const accion = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `T${corrida}P`, nombre: "Acción ficticia" } });
    await retirada("2027-06-29", "2027-06-28", "d3".repeat(32), accion.id);
    const traer = async () => ({ ok: true as const, cierres: [{ fecha: dia("2027-06-28"), precio: "2371", volumen: 413 }, { fecha: dia("2027-06-29"), precio: "2371", volumen: 389 }] });
    const r = await guardarCierresDeEspecies(db, [{ instrumentoId: accion.id, traer }], { desde: dia("2027-06-28"), hasta: dia("2027-06-29"), ahora: new Date("2027-07-02T15:00:00Z") });
    expect(r.fallidas).toEqual([]);
    const vigentes = await db.precioCierre.findMany({ where: { instrumentoId: accion.id, reemplazadoEn: null }, orderBy: { fecha: "asc" }, select: { fecha: true, estado: true, fuenteReferencia: true } });
    expect(vigentes).toEqual([
      { fecha: dia("2027-06-28"), estado: "VERIFICADO", fuenteReferencia: "certificacion:2027-06-28" },
      { fecha: dia("2027-06-29"), estado: "NO_VERIFICADO", fuenteReferencia: null },
    ]);
  });
});
