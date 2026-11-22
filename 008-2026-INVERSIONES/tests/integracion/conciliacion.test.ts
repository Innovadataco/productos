// Conciliación por fecha de corte (PR-B) contra la base de PRUEBAS: órdenes de Trii ficticias importadas con su
// importador, la certificación ficticia importada con el suyo y cierres del día del corte. Se guarda una
// conciliación por corrida (historia), con un control por regla y su motivo. Datos inventados.
// La conciliación lee TODA la cuenta (un solo dueño): en la base compartida ve también lo que dejaron los archivos
// que corrieron antes, y vitest los ordena por la duración de la corrida anterior. Por eso cada camino del cálculo
// (retiros, sin dividendos ni ajustes, escisión, T+2) tiene aquí un caso con datos propios: la cobertura de
// esperado.ts no depende del orden de los archivos.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorConciliacion, conciliarCertificacion } from "@/conciliacion/conciliar";
import { registrarEscision, validarEscision } from "@/eventos/escision";
import { importarCertificacion } from "@/importacion/av/importar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { registrarLoteEscision } from "@/lotes/escision";
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

const iso = (d: Date) => d.toISOString().slice(0, 10);
const idDe = async (nemo: string) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: nemo } })).id;

/** Carga un CSV ficticio de Trii (órdenes, caja o dividendos) con su importador. */
async function cargarTrii(nombreArchivo: string, csv: string) {
  const t = await importarArchivoTrii(db, { nombreArchivo, contenido: new TextEncoder().encode(csv), usuarioId: duenoId });
  expect(t.estado).toBe("CARGADO");
}

/** Importa la certificación ficticia del corte con esas posiciones y un fondo propio del caso `k` (datos inventados). */
async function certificar(fecha: Date, rentaVariable: EspecCertificacion["rentaVariable"]) {
  const fic = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `6${String(k).padStart(3, "0")}1`, nombre: "Fondo ficticio" } });
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: `99800${String(k).padStart(4, "0")}-0` }],
    rentaVariable,
    creadoEn: `D:${iso(new Date(fecha.getTime() + DIA)).replace(/-/g, "")}101500-05'00'`,
  };
  const c = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: fecha, fondoCodigo: fic.codigoFic, hoy: new Date(fecha.getTime() + 2 * DIA) });
  expect(c.errores).toEqual([]);
  return fic;
}

/** Un miércoles distinto de 2026 por caso, con sus especies, su fondo y su PDF (datos inventados). */
async function caso(opciones: { extraB?: number; cantidadB?: string; valorB?: string } = {}) {
  k += 1;
  const fecha = new Date(Date.UTC(2026, 1, 4) + (k - 1) * 7 * DIA);
  const nemos = ["A", "B", "C"].map((l) => `K${corrida}${k}${l}`);
  const antes = new Date(fecha.getTime() - 14 * DIA);
  const filas = [orden(antes, nemos[0]!, "Compra", 100, 1000), orden(antes, nemos[0]!, "Compra", 50, 1000), orden(antes, nemos[1]!, "Compra", 2000, 20), orden(antes, nemos[2]!, "Compra", 10, 32500)];
  if (opciones.extraB) filas.push(orden(new Date(fecha.getTime() - DIA), nemos[1]!, "Compra", opciones.extraB, 20));
  await cargarTrii(`ordenes-${k}.ficticio.csv`, `${ENCABEZADO}\n${filas.join("\n")}\n`);
  const rv = CERTIFICACION_FICTICIA.rentaVariable;
  const fic = await certificar(fecha, [
    { ...rv[0]!, nemo: nemos[0]! }, { ...rv[1]!, nemo: nemos[0]! },
    { ...rv[2]!, nemo: nemos[1]!, cantidad: opciones.cantidadB ?? rv[2]!.cantidad, valor: opciones.valorB ?? rv[2]!.valor },
    { ...rv[3]!, nemo: nemos[2]! },
  ]);
  const ids = await Promise.all(nemos.map(idDe));
  return { fecha, nemos, ids, fic };
}

type Caso = Awaited<ReturnType<typeof caso>>;
const cierres = (c: Caso, precios: (string | null)[]) =>
  Promise.all(c.ids.map((id, i) => (precios[i] === null ? null : db.precioCierre.create({ data: { instrumentoId: id, fecha: c.fecha, precio: dec(precios[i]!), fuente: "yahoo", estado: "VERIFICADO" } }))));

const controles = async (conciliacionId: string) =>
  db.controlConciliacion.findMany({ where: { conciliacionId }, select: { tipo: true, instrumentoId: true, resultado: true, codigoMotivo: true, esperado: true, real: true, diferencia: true, tolerancia: true, detalle: true } });
type Controles = Awaited<ReturnType<typeof controles>>;
const conciliarYLeer = async (fechaCorte: Date) => controles((await conciliarCertificacion(db, { fechaCorte })).conciliacionId);
/** Un control como texto (tipo, resultado, motivo, esperado, real), para comparar sin la escala de los decimales. */
const enTexto = (cs: Controles, tipo: string, instrumentoId: string | null = null) => {
  const c = cs.find((x) => x.tipo === tipo && x.instrumentoId === instrumentoId);
  return c ? [c.resultado, c.codigoMotivo, c.esperado?.toString() ?? null, c.real?.toString() ?? null] : null;
};

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
    await cierres(c, ["1000", "20", "32500"]);
    const r = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    expect(r).toMatchObject({ fechaCorte: c.fecha.toISOString().slice(0, 10), resultado: "NO_CUADRA", versionCalculo: "conciliacion-v3" });
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
    await cierres(c, ["1000", "20", "32500"]);
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    expect(cs.find((x) => x.tipo === "CANTIDAD" && x.instrumentoId === c.ids[1])).toMatchObject({
      resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", esperado: dec("2000"), real: dec("2010"), diferencia: dec("10"), detalle: { pendientes: 1, operada: "2010" },
    });
    const valor = cs.find((x) => x.tipo === "VALOR" && x.instrumentoId === c.ids[1])!;
    expect([valor.resultado, valor.codigoMotivo, valor.esperado?.toString(), valor.real?.toString()]).toEqual(["PENDIENTE_LIQUIDACION", "t_mas_2", "40200", "40200"]);
  });

  it("sin el cierre del día del corte de una especie: VALOR sin_precio_al_corte (no se usa el día anterior)", async () => {
    const c = await caso();
    await cierres(c, ["1000", null, "32500"]);
    await db.precioCierre.create({ data: { instrumentoId: c.ids[1]!, fecha: new Date(c.fecha.getTime() - DIA), precio: dec("20"), fuente: "yahoo", estado: "VERIFICADO" } });
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    expect(cs.find((x) => x.tipo === "VALOR" && x.instrumentoId === c.ids[1])).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", esperado: null });
  });
});

describe("conciliarCertificacion: fondo, efectivo e historia", () => {
  it("con las unidades del fondo y el valor de unidad del corte, el fondo cuadra; con la caja completa, el efectivo también", async () => {
    const c = await caso();
    await cierres(c, ["1000", "20", "32500"]);
    // La caja es de toda la cuenta (en la base de pruebas, también de los otros casos): se mide la de antes y se
    // completa con un depósito para que, junto con el aporte al fondo de −6 250 000, quede en los 1 000 certificados.
    const antes = new Date(c.fecha.getTime() - 20 * DIA);
    const previa = (await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId)).find((x) => x.tipo === "EFECTIVO")!;
    const deposito = dec("1000").sub(previa.esperado!).add("6250000");
    const carga = await importarArchivoTrii(db, {
      nombreArchivo: `caja-${k}.ficticio.csv`, usuarioId: duenoId,
      contenido: new TextEncoder().encode(`Fecha y hora,Tipo de movimiento,Estado,Valor total\n${trii(antes)},Depósito,Aprobado,${deposito.toFixed(4)}\n`),
    });
    expect(carga.estado).toBe("CARGADO");
    const ajuste = await db.ajusteCaja.create({ data: { fecha: antes, monto: dec("-6250000"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId } });
    await db.movimientoFondo.create({ data: { fondoId: c.fic.id, fecha: antes, unidades: dec("1000"), monto: dec("6250000"), tipo: "CONSTITUCION", fuente: "MANUAL", ajusteCajaId: ajuste.id } });
    await db.valorUnidadFondo.create({ data: { fondoId: c.fic.id, fechaValor: c.fecha, valorUnidad: dec("6250") } });
    const cs = await controles((await conciliarCertificacion(db, { fechaCorte: c.fecha })).conciliacionId);
    const fondo = cs.find((x) => x.tipo === "FONDO")!;
    expect([fondo.resultado, fondo.esperado?.toString(), fondo.real?.toString()]).toEqual(["CUADRA", "6250000", "6250000"]);
    const efectivo = cs.find((x) => x.tipo === "EFECTIVO")!;
    expect([efectivo.resultado, efectivo.esperado?.toString(), efectivo.real?.toString(), efectivo.tolerancia?.toString(), efectivo.codigoMotivo]).toEqual(["CUADRA", "1000", "1000", "1", null]);
    for (const id of c.ids) expect(cs.filter((x) => x.instrumentoId === id).map((x) => x.resultado)).toEqual(["CUADRA", "CUADRA"]);
  });

  it("un dividendo pagado hasta el corte suma su neto a la caja esperada; uno pagado después, no", async () => {
    const c = await caso();
    const efectivo = async () => enTexto(await conciliarYLeer(c.fecha), "EFECTIVO")![2]!;
    const antes = await efectivo();
    const pagos = [`${iso(new Date(c.fecha.getTime() - 2 * DIA))},${c.nemos[0]},,123.0`, `${iso(new Date(c.fecha.getTime() + DIA))},${c.nemos[1]},,7.0`];
    await cargarTrii(`dividendos-${k}.ficticio.csv`, `Fecha y hora,Ticker,Estado,Valor total\n${pagos.join("\n")}\n`);
    expect(dec(await efectivo()).sub(antes).toString()).toBe("123");
  });

  it("conciliar otra vez guarda otra conciliación (historia); nada se edita", async () => {
    const c = await caso();
    const a = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    await cierres(c, ["1000", "20", "32500"]);
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

describe("conciliarCertificacion: escisión y T+2 con datos propios", () => {
  it("el lote de escisión cuenta; un destino sin lote dice escision_sin_lote; la compra del día anterior va a T+2", async () => {
    k += 1;
    const fecha = new Date(Date.UTC(2026, 1, 4) + (k - 1) * 7 * DIA);
    const [a, x, y, d, e] = ["A", "X", "Y", "D", "E"].map((l) => `K${corrida}${k}${l}`) as [string, string, string, string, string];
    const ayer = new Date(fecha.getTime() - DIA);
    const evento = iso(new Date(fecha.getTime() - 7 * DIA));
    // D y E se compran el día anterior al corte (liquidan después). D está certificada; E no.
    const filas = [orden(new Date(fecha.getTime() - 14 * DIA), a, "Compra", 100, 1000), orden(ayer, d, "Compra", 10, 50), orden(ayer, e, "Compra", 5, 40)];
    await cargarTrii(`ordenes-${k}.ficticio.csv`, `${ENCABEZADO}\n${filas.join("\n")}\n`);
    // El lote madre del origen, armado a mano como en cli.test.ts (sin construirLotes sobre toda la base).
    const madre = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: a } } });
    await db.lote.create({
      data: {
        instrumentoId: madre.instrumentoId, origen: "COMPRA", ordenId: madre.id, fuenteCosto: "TRII_ORDEN", fechaCompra: madre.fechaOperacion,
        fechaLiquidacion: madre.fechaLiquidacion, cantidad: madre.cantidadCompletada, costoUnitario: madre.precioUnitario, costoTotal: madre.totalInvertido, comision: madre.comision,
      },
    });
    for (const destino of [x, y]) {
      const v = validarEscision({ origen: a, destino, fecha: evento });
      if (!v.ok) throw new Error(`escisión ficticia inválida: ${JSON.stringify(v.errores)}`);
      await registrarEscision(db, v.valor, { crearDestino: true });
    }
    await registrarLoteEscision(db, { destino: x, fechaEvento: evento, cantidad: "30", costoUnitario: "100" });
    await certificar(fecha, [
      { nemo: a, cantidad: "100", precio: "COP 1.000,00", valor: "COP 100.000,00" },
      { nemo: x, cantidad: "30", precio: "COP 100,00", valor: "COP 3.000,00" },
      { nemo: y, cantidad: "20", precio: "COP 100,00", valor: "COP 2.000,00" },
      { nemo: d, cantidad: "10", precio: "COP 50,00", valor: "COP 500,00" },
    ]);
    const cs = await conciliarYLeer(fecha);
    const [idA, idX, idY, idD, idE] = await Promise.all([a, x, y, d, e].map(idDe));
    expect(enTexto(cs, "CANTIDAD", idA)).toEqual(["CUADRA", null, "100", "100"]);
    expect(enTexto(cs, "CANTIDAD", idX)).toEqual(["CUADRA", null, "30", "30"]);
    expect(enTexto(cs, "CANTIDAD", idY)).toEqual(["NO_CUADRA", "escision_sin_lote", "0", "20"]);
    expect(enTexto(cs, "CANTIDAD", idD)).toEqual(["PENDIENTE_LIQUIDACION", "t_mas_2", "0", "10"]);
    expect(cs.find((c) => c.tipo === "CANTIDAD" && c.instrumentoId === idD)?.detalle).toEqual({ pendientes: 1, operada: "10" });
    // E (operada, sin liquidar y sin certificar) entra al cálculo por lo operado y hoy se compara contra lo
    // liquidado: 0 contra 0. Si la certificación de A&V incluye lo no liquidado, debería salir NO_CUADRA (pregunta abierta).
    expect(enTexto(cs, "CANTIDAD", idE)).toEqual(["CUADRA", null, "0", "0"]);
  });
});

describe("conciliarCertificacion: corte sin historia", () => {
  it("sin dividendos ni ajustes al corte, la caja es depósitos − retiros; una especie sin órdenes dice por qué", async () => {
    k += 1;
    // Miércoles hábil de 2022 (calendario BVC sembrado). Ningún archivo de integración escribe órdenes, caja,
    // dividendos, ajustes ni escisiones antes de 2023: este corte solo ve lo suyo, en cualquier orden de archivos.
    // Si un archivo nuevo escribe antes de 2023, la guarda de abajo falla: mueva este corte antes de esos datos.
    const fecha = new Date(Date.UTC(2022, 5, 1));
    const alCorte = { lte: fecha };
    const ajenas = await Promise.all([
      db.orden.count({ where: { fechaOperacion: alCorte } }), db.movimientoCaja.count({ where: { fecha: alCorte } }),
      db.dividendo.count({ where: { fechaPago: alCorte } }), db.ajusteCaja.count({ where: { fecha: alCorte } }),
      db.eventoCorporativo.count({ where: { fecha: alCorte } }), db.lote.count({ where: { fechaCompra: alCorte } }),
    ]);
    expect(ajenas, "otro archivo escribió datos antes del corte de 2022: este caso deja de ser determinista").toEqual([0, 0, 0, 0, 0, 0]);
    const caja = [`${trii(new Date(Date.UTC(2022, 4, 2)))},Depósito,Aprobado,500.0`, `${trii(new Date(Date.UTC(2022, 4, 3)))},Retiro,Aprobado,500.0`];
    await cargarTrii(`caja-${k}.ficticio.csv`, `Fecha y hora,Tipo de movimiento,Estado,Valor total\n${caja.join("\n")}\n`);
    expect(await db.movimientoCaja.count({ where: { fecha: alCorte } })).toBe(2);
    const sola = `K${corrida}${k}S`;
    const fic = await certificar(fecha, [{ nemo: sola, cantidad: "10", precio: "COP 1.237,00", valor: "COP 12.370,00" }]);
    const cs = await conciliarYLeer(fecha);
    expect(enTexto(cs, "CANTIDAD", await idDe(sola))).toEqual(["NO_CUADRA", "sin_operaciones_en_sistema", "0", "10"]);
    // 500 − 500 = 0, sin dividendos ni ajustes (sus sumas vienen vacías de la base).
    expect(enTexto(cs, "EFECTIVO")).toEqual(["NO_CUADRA", "aporte_fic_sin_registrar", "0", "1000"]);
    expect(enTexto(cs, "FONDO", fic.id)).toEqual(["NO_CUADRA", "fondo_sin_unidades", null, "6250000"]);
  });
});
