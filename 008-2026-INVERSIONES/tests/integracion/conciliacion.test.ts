// Conciliación por fecha de corte (PR-B) contra la base de PRUEBAS: órdenes de Trii ficticias importadas con su
// importador, la certificación ficticia importada con el suyo y cierres del día del corte. Se guarda una
// conciliación por corrida (historia), con un control por regla y su motivo. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorConciliacion, conciliarCertificacion } from "@/conciliacion/conciliar";
import { importarCertificacion } from "@/importacion/av/importar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const DIA = 86_400_000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
let k = 0;
let duenoId = "";
const dec = (v: string) => new Prisma.Decimal(v);

const trii = (d: Date) => `"${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, 10:00 a. m."`;
const orden = (d: Date, nemo: string, lado: "Compra" | "Venta", cantidad: number, precio: number) =>
  `${trii(d)},${nemo},${lado},Aprobado,${cantidad}/${cantidad},0,${precio}.0,${cantidad * precio}.0,0,${cantidad * precio}.0`;
const ENCABEZADO = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";

/** Un miércoles distinto de 2026 por caso, con sus especies, su fondo y su PDF (datos inventados). */
async function caso(opciones: { extraB?: number; cantidadB?: string; valorB?: string } = {}) {
  k += 1;
  const fecha = new Date(Date.UTC(2026, 1, 4) + (k - 1) * 7 * DIA);
  const nemos = ["A", "B", "C"].map((l) => `K${corrida}${k}${l}`);
  const nit = `99800${String(k).padStart(4, "0")}-0`;
  const antes = new Date(fecha.getTime() - 14 * DIA);
  const filas = [orden(antes, nemos[0]!, "Compra", 100, 1000), orden(antes, nemos[0]!, "Compra", 50, 1000), orden(antes, nemos[1]!, "Compra", 2000, 20), orden(antes, nemos[2]!, "Compra", 10, 30000)];
  if (opciones.extraB) filas.push(orden(new Date(fecha.getTime() - DIA), nemos[1]!, "Compra", opciones.extraB, 20));
  const t = await importarArchivoTrii(db, { nombreArchivo: `ordenes-${k}.ficticio.csv`, contenido: new TextEncoder().encode(`${ENCABEZADO}\n${filas.join("\n")}\n`), usuarioId: duenoId });
  expect(t.estado).toBe("CARGADO");
  const fic = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `6${String(k).padStart(3, "0")}1`, nombre: "Fondo ficticio" } });
  const rv = CERTIFICACION_FICTICIA.rentaVariable;
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
    rentaVariable: [
      { ...rv[0]!, nemo: nemos[0]! }, { ...rv[1]!, nemo: nemos[0]! },
      { ...rv[2]!, nemo: nemos[1]!, cantidad: opciones.cantidadB ?? rv[2]!.cantidad, valor: opciones.valorB ?? rv[2]!.valor },
      { ...rv[3]!, nemo: nemos[2]! },
    ],
    creadoEn: `D:${new Date(fecha.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  const c = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: fecha, fondoCodigo: fic.codigoFic, hoy: new Date(fecha.getTime() + 2 * DIA) });
  expect(c.errores).toEqual([]);
  const ids = await Promise.all(nemos.map(async (n) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: n } })).id));
  return { fecha, nemos, ids, fic };
}

type Caso = Awaited<ReturnType<typeof caso>>;
const cierres = (c: Caso, precios: (string | null)[]) =>
  Promise.all(c.ids.map((id, i) => (precios[i] === null ? null : db.precioCierre.create({ data: { instrumentoId: id, fecha: c.fecha, precio: dec(precios[i]!), fuente: "yahoo", estado: "VERIFICADO" } }))));

const controles = async (conciliacionId: string) =>
  db.controlConciliacion.findMany({ where: { conciliacionId }, select: { tipo: true, instrumentoId: true, resultado: true, codigoMotivo: true, esperado: true, real: true, diferencia: true, tolerancia: true, detalle: true } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-conc-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("conciliarCertificacion: acciones", () => {
  it("cantidades y valores cuadran al corte; el fondo sin unidades y el efectivo sin el aporte dicen por qué", async () => {
    const c = await caso();
    await cierres(c, ["1000", "20", "30000"]);
    const r = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    expect(r).toMatchObject({ fechaCorte: c.fecha.toISOString().slice(0, 10), resultado: "NO_CUADRA", versionCalculo: "conciliacion-v1" });
    const cs = await controles(r.conciliacionId);
    for (const id of c.ids) {
      expect(cs.find((x) => x.tipo === "CANTIDAD" && x.instrumentoId === id)).toMatchObject({ resultado: "CUADRA", codigoMotivo: null });
      expect(cs.find((x) => x.tipo === "VALOR" && x.instrumentoId === id)).toMatchObject({ resultado: "CUADRA" });
    }
    expect(cs.find((x) => x.tipo === "VALOR" && x.instrumentoId === null)).toMatchObject({ resultado: "CUADRA" });
    expect(cs.find((x) => x.tipo === "FONDO")).toMatchObject({ instrumentoId: c.fic.id, resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades" });
    expect(cs.find((x) => x.tipo === "EFECTIVO")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "aporte_fic_sin_registrar" });
    const conc = await db.conciliacion.findUniqueOrThrow({ where: { id: r.conciliacionId }, include: { certificacion: true } });
    expect(conc.fechaCorte.getTime()).toBe(conc.certificacion.fechaCorte.getTime());
  });

  it("una compra del día anterior que la certificación ya cuenta: PENDIENTE_LIQUIDACION t_mas_2 en esa especie", async () => {
    const c = await caso({ extraB: 10, cantidadB: "2010", valorB: "COP 40.200,00" });
    await cierres(c, ["1000", "20", "30000"]);
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    expect(cs.find((x) => x.tipo === "CANTIDAD" && x.instrumentoId === c.ids[1])).toMatchObject({
      resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", esperado: dec("2000"), real: dec("2010"), diferencia: dec("10"), detalle: { pendientes: 1, operada: "2010" },
    });
  });

  it("sin el cierre del día del corte de una especie: VALOR sin_precio_al_corte (no se usa el día anterior)", async () => {
    const c = await caso();
    await cierres(c, ["1000", null, "30000"]);
    await db.precioCierre.create({ data: { instrumentoId: c.ids[1]!, fecha: new Date(c.fecha.getTime() - DIA), precio: dec("20"), fuente: "yahoo", estado: "VERIFICADO" } });
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    expect(cs.find((x) => x.tipo === "VALOR" && x.instrumentoId === c.ids[1])).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", esperado: null });
  });
});

describe("conciliarCertificacion: fondo, efectivo e historia", () => {
  it("con las unidades del fondo y el valor de unidad del corte, el fondo cuadra; con la caja completa, el efectivo también", async () => {
    const c = await caso();
    await cierres(c, ["1000", "20", "30000"]);
    // La caja es de toda la cuenta (en la base de pruebas, también de los otros casos): se mide la de antes y se
    // completa con un depósito para que, junto con el aporte al fondo de −5 000 000, quede en los 1 000 certificados.
    const antes = new Date(c.fecha.getTime() - 20 * DIA);
    const previa = (await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId)).find((x) => x.tipo === "EFECTIVO")!;
    const deposito = dec("1000").sub(previa.esperado!).add("5000000");
    const carga = await importarArchivoTrii(db, {
      nombreArchivo: `caja-${k}.ficticio.csv`, usuarioId: duenoId,
      contenido: new TextEncoder().encode(`Fecha y hora,Tipo de movimiento,Estado,Valor total\n${trii(antes)},Depósito,Aprobado,${deposito.toFixed(1)}\n`),
    });
    expect(carga.estado).toBe("CARGADO");
    const ajuste = await db.ajusteCaja.create({ data: { fecha: antes, monto: dec("-5000000"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId } });
    await db.movimientoFondo.create({ data: { fondoId: c.fic.id, fecha: antes, unidades: dec("1000"), tipo: "CONSTITUCION", fuente: "MANUAL", ajusteCajaId: ajuste.id } });
    await db.valorUnidadFondo.create({ data: { fondoId: c.fic.id, fechaValor: c.fecha, valorUnidad: dec("5000") } });
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    const fondo = cs.find((x) => x.tipo === "FONDO")!;
    expect([fondo.resultado, fondo.esperado?.toString(), fondo.real?.toString()]).toEqual(["CUADRA", "5000000", "5000000"]);
    const efectivo = cs.find((x) => x.tipo === "EFECTIVO")!;
    expect([efectivo.resultado, efectivo.esperado?.toString(), efectivo.real?.toString(), efectivo.tolerancia?.toString(), efectivo.codigoMotivo]).toEqual(["CUADRA", "1000", "1000", "1", null]);
    for (const id of c.ids) expect(cs.filter((x) => x.instrumentoId === id).map((x) => x.resultado)).toEqual(["CUADRA", "CUADRA"]);
  });

  it("conciliar otra vez guarda otra conciliación (historia); nada se edita", async () => {
    const c = await caso();
    const a = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    await cierres(c, ["1000", "20", "30000"]);
    const b = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    expect(b.conciliacionId).not.toBe(a.conciliacionId);
    expect(await db.conciliacion.count({ where: { fechaCorte: c.fecha } })).toBe(2);
    expect((await controles(a.conciliacionId)).filter((x) => x.codigoMotivo === "sin_precio_al_corte").length).toBeGreaterThan(0);
  });

  it("sin certificación para esa fecha: ErrorConciliacion SIN_CERTIFICACION", async () => {
    await expect(conciliarCertificacion(db, { fechaCorte: new Date("2026-12-30T00:00:00Z") })).rejects.toBeInstanceOf(ErrorConciliacion);
    await expect(conciliarCertificacion(db, { fechaCorte: new Date("2026-12-30T00:00:00Z") })).rejects.toMatchObject({ codigo: "SIN_CERTIFICACION" });
  });
});
