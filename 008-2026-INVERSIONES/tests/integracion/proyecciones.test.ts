// Integración del lector del motor de proyecciones (hito 2 del PRD de visualización y proyecciones). Datos INVENTADOS
// y cifras raras. La base se comparte con los demás archivos: todo se busca por los nemotécnicos de esta corrida y el
// cálculo puro se corre sobre las entradas filtradas a lo de esta corrida.
// Fechas: la historia de cierres y de valores del fondo es de 2019-2020 (antes de 2022; no entran en la guarda de
// conciliacion.test.ts). Órdenes, dividendos, escisiones y los movimientos del fondo (con su ajuste de caja) van en
// diciembre de 2027: después de todos los cortes de los demás archivos, en el año sembrado (el importador exige el
// calendario) y nunca antes de 2023 (esa guarda). Los cierres de las especies vivas terminan en 2020: no mueven la
// fecha de referencia del tablero (16-nov-2027).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cifrarCrudo } from "@/cifrado/campos";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { calcularProyeccion } from "@/proyecciones/calcular";
import { dividendosPorAccion } from "@/proyecciones/dividendos";
import { leerEntradas } from "@/proyecciones/leer";
import { proyectar } from "@/proyecciones/proyectar";
import type { AccionEntrada, EntradasProyeccion, FondoEntrada, ParametrosProyeccion } from "@/proyecciones/tipos";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = { a: `PA${corrida}`, o: `PO${corrida}`, d: `PD${corrida}`, z: `PZ${corrida}`, inc: `PI${corrida}` };
const HOY = new Date("2027-12-31T00:00:00Z");
const DIA_MS = 86_400_000;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const csv = (t: string) => new TextEncoder().encode(t);
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const DIV = "Fecha y hora,Ticker,Estado,Valor total\n";

/** 420 días de lunes a viernes desde el 2-ene-2019 (2019 y 2020 no están sembrados en calendario_bvc). */
const dias: Date[] = [];
for (let d = dia("2019-01-02"); dias.length < 420; d = new Date(d.getTime() + DIA_MS)) if (d.getUTCDay() % 6 !== 0) dias.push(d);
const EVENTO = dia("2027-12-10");
const precioA = (j: number) => (1237.41 + 0.37 * j + 5.3 * Math.sin(j)).toFixed(2);
const precioO = (j: number) => (905.63 + 0.19 * j).toFixed(2);
const precioD = (j: number) => (812.29 + 0.07 * j).toFixed(2);
const SABADO = dia("2019-06-15");
const ids: Record<string, string> = {};
let fondoId = "";
let fondoVacioId = "";
let fondoCeroId = "";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email: `dueno-py-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const imp = (nombre: string, t: string) => importarArchivoTrii(db, { nombreArchivo: nombre, contenido: csv(t), usuarioId: duenoId });

  const d = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo.d, nombre: "Destino ficticio" } });
  const z = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo.z, nombre: "Origen ficticio de una fracción" } });
  await imp("o.ficticio.csv", ORD + [
    `"6 dic 2027, 10:00 a. m.",${nemo.a},Compra,Aprobado,1237,0,10.37,12827.69,7.13,12834.82`,
    `"6 dic 2027, 10:00 a. m.",${nemo.o},Compra,Aprobado,311,0,23.71,7373.81,7.13,7380.94`,
    `"6 dic 2027, 10:00 a. m.",${nemo.inc},Compra,Aprobado,13,0,10.0,130.0,7.13,137.13`,
    `"7 dic 2027, 10:00 a. m.",${nemo.inc},Venta,Aprobado,29,0,15.0,435.0,7.13,427.87`,
  ].join("\n") + "\n");
  for (const n of ["a", "o", "inc"] as const) ids[n] = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo[n] } })).id;
  ids["d"] = d.id;
  await db.eventoCorporativo.create({ data: { tipo: "ESCISION", fecha: EVENTO, origenId: ids["o"]!, destinoId: d.id, razon: new Prisma.Decimal("0.37") } });
  // Una fracción de escisión pagada sobre A: no es dividendo y el lector no la trae.
  await db.eventoCorporativo.create({ data: { tipo: "ESCISION", fecha: dia("2027-12-09"), origenId: z.id, destinoId: ids["a"]!, fechaPagoFraccion: dia("2027-12-15") } });
  await imp("d.ficticio.csv", `${DIV}2027-12-20,${nemo.a},,733.19\n2027-12-15,${nemo.a},,41.37\n`);
  await construirLotes(db);

  const cierre = (instrumentoId: string, fecha: Date, precio: string, extra: Partial<Prisma.PrecioCierreCreateManyInput> = {}) =>
    ({ instrumentoId, fecha, precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const, ...extra });
  await db.precioCierre.createMany({
    data: [
      ...dias.map((f, j) => cierre(ids["a"]!, f, precioA(j))),
      ...dias.map((f, j) => cierre(ids["o"]!, f, precioO(j))),
      ...dias.slice(300).map((f, j) => cierre(d.id, f, precioD(j))), // el destino no se tiene: el lector igual trae sus cierres
      cierre(ids["a"]!, SABADO, "1311.97"), // barra suelta en sábado: el lector la trae, la historia la descarta
      cierre(ids["a"]!, dias[10]!, "9999.13", { reemplazadoEn: new Date() }), // reemplazado: no se lee
      cierre(ids["a"]!, dias[11]!, "8888.17", { fuente: "otra" }), // otra fuente: no se lee
      cierre(ids["a"]!, dia("2017-06-14"), "1111.37"), // más de 10 años antes de hoy: no se lee
    ],
  });
  // Decretos con la forma de la fase C (migración *_datos_oficiales): cada versión nace de su fila cruda del registro
  // (REGISTRO_DECRETOS, cifrada), con su referencia oficial, y una corrección es la versión siguiente, que retira a la
  // anterior. El lector solo trae las vigentes y no anuladas: la v1 de 2020-07-15 (otro valor) y la anulada de
  // 2020-09-16 no se leen.
  const cargaDecretos = await db.cargaArchivo.create({
    data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "decretos.ficticio.csv", sha256: "d".repeat(64), estado: "CARGADO", cargadoPorId: duenoId },
  });
  let filaDecreto = 0;
  const decreto = async (d: { valor: string; anuncio: string; cuota: number; ex: string; pago: string; version?: number; anulada?: boolean; retirar?: boolean }) => {
    filaDecreto += 1;
    const llave = { tipoFuente: "REGISTRO_DECRETOS" as const, claveNatural: `py${corrida}decreto${filaDecreto}`.padStart(64, "0"), ocurrencia: 1 };
    const fila = await db.filaFuente.create({
      data: { ...llave, primeraCargaId: cargaDecretos.id, primeraFilaNo: filaDecreto, crudo: cifrarCrudo({ especie: nemo.a, valor: d.valor, pago: d.pago }, llave) },
    });
    const { id } = await db.dividendoDecretado.create({
      data: {
        filaFuenteId: fila.id, instrumentoId: ids["a"]!, tipo: "ORDINARIO", valorPorAccion: new Prisma.Decimal(d.valor), fechaAnuncio: dia(d.anuncio), cuota: d.cuota,
        fechaEx: dia(d.ex), fechaPago: dia(d.pago), referenciaOficial: "https://www.superfinanciera.gov.co/ficticio/decreto", version: d.version ?? 1,
        anulada: d.anulada ?? false, nota: d.anulada ? "anulado en la prueba" : null,
      },
    });
    if (d.retirar) await db.dividendoDecretado.update({ where: { id }, data: { reemplazadoEn: new Date() } });
  };
  await decreto({ valor: "3.71", anuncio: "2020-03-11", cuota: 1, ex: "2020-07-08", pago: "2020-07-15", retirar: true });
  await decreto({ valor: "3.47", anuncio: "2020-03-11", cuota: 1, ex: "2020-07-08", pago: "2020-07-15", version: 2 });
  await decreto({ valor: "4.61", anuncio: "2020-03-11", cuota: 2, ex: "2020-09-09", pago: "2020-09-16", retirar: true });
  await decreto({ valor: "4.61", anuncio: "2020-03-11", cuota: 2, ex: "2020-09-09", pago: "2020-09-16", version: 2, anulada: true });
  await decreto({ valor: "3.13", anuncio: "2027-03-17", cuota: 2, ex: "2028-04-05", pago: "2028-04-12" });
  // Un decreto cuyo pago de Trii llegó el mismo día: el motor lo descarta por ese pago. Desde la fase C la base no guarda
  // el enlace (dividendo."decretadoId" es siempre nulo: el cruce se calcula al leer), así que la fila va sin él, a mano
  // y cifrada.
  await decreto({ valor: "0.0391", anuncio: "2027-03-17", cuota: 1, ex: "2027-12-15", pago: "2027-12-22" });
  // El borde de la cota de los decretos: los pagos se leen desde hoy − 10 años (2017-12-31) y un pago de Trii cabe en
  // la ventana de un decreto con pago hasta VENTANA_PAGO_DESPUES_DIAS (10) días antes. El de 2017-12-21 se lee; el del
  // 20, no.
  await decreto({ valor: "2.17", anuncio: "2017-11-08", cuota: 1, ex: "2017-12-14", pago: "2017-12-21" });
  await decreto({ valor: "2.19", anuncio: "2017-11-08", cuota: 2, ex: "2017-12-13", pago: "2017-12-20" });
  const carga = await db.cargaArchivo.create({
    data: { tipoFuente: "TRII_DIVIDENDOS", nombreArchivo: "enlazado.ficticio.csv", sha256: "e".repeat(64), estado: "CARGADO", cargadoPorId: duenoId },
  });
  const llave = { tipoFuente: "TRII_DIVIDENDOS", claveNatural: `py${corrida}enlazado`.padStart(64, "0"), ocurrencia: 1 };
  const fila = await db.filaFuente.create({
    data: { ...llave, tipoFuente: "TRII_DIVIDENDOS", primeraCargaId: carga.id, primeraFilaNo: 1, crudo: cifrarCrudo({ "Fecha y hora": "2027-12-22", Ticker: nemo.a, "Valor total": "47.93" }, llave) },
  });
  await db.dividendo.create({
    data: { filaFuenteId: fila.id, fechaPago: dia("2027-12-22"), instrumentoId: ids["a"]!, montoNeto: new Prisma.Decimal("47.93") },
  });

  fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `9${corrida}1`, nombre: "Fondo ficticio de proyecciones" } })).id;
  fondoVacioId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `9${corrida}2`, nombre: "Fondo ficticio sin valores" } })).id;
  fondoCeroId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `9${corrida}3`, nombre: "Fondo ficticio retirado" } })).id;
  // Una constitución o un aporte llevan su ajuste de caja APORTE_FIC de la misma fecha y con −monto (migración
  // movimiento_fondo_reglas, como en fondo-corte.test.ts). En dic-2027: un ajuste antes de 2023 rompe la guarda de
  // conciliacion.test.ts, y ninguna fecha de corte de los demás archivos llega a diciembre de 2027.
  const pagado = async (fondo: string, fecha: string, unidades: string, monto: string, tipo: "CONSTITUCION" | "APORTE") => {
    const ajuste = await db.ajusteCaja.create({
      data: { fecha: dia(fecha), monto: new Prisma.Decimal(`-${monto}`), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId },
    });
    await db.movimientoFondo.create({
      data: { fondoId: fondo, fecha: dia(fecha), unidades: new Prisma.Decimal(unidades), monto: new Prisma.Decimal(monto), tipo, fuente: "MANUAL", ajusteCajaId: ajuste.id },
    });
  };
  const retiro = (fondo: string, fecha: string, unidades: string) =>
    db.movimientoFondo.create({ data: { fondoId: fondo, fecha: dia(fecha), unidades: new Prisma.Decimal(unidades), tipo: "RETIRO", fuente: "MANUAL" } });
  await pagado(fondoId, "2027-12-20", "1237.4321", "15731.4129", "CONSTITUCION");
  await pagado(fondoId, "2027-12-21", "311.2468", "3961.2273", "APORTE");
  await retiro(fondoId, "2027-12-22", "48.7519");
  await pagado(fondoId, "2028-02-09", "97.13", "1247.5361", "APORTE"); // después de hoy
  await pagado(fondoVacioId, "2027-12-20", "7.31", "93.0817", "CONSTITUCION");
  await pagado(fondoCeroId, "2027-12-20", "7.13", "91.3349", "CONSTITUCION");
  await retiro(fondoCeroId, "2027-12-21", "7.13");
  const vu = (j: number) => new Prisma.Decimal((12731.4419 * 1.00013 ** j).toFixed(8));
  await db.valorUnidadFondo.createMany({
    data: [
      ...Array.from({ length: 640 }, (_, j) => ({ fondoId, fechaValor: new Date(dia("2018-12-20").getTime() + j * DIA_MS), valorUnidad: vu(j) })),
      { fondoId, fechaValor: dia("2019-03-05"), valorUnidad: new Prisma.Decimal("1.37"), reemplazadoEn: new Date() },
    ],
  });
});

afterAll(async () => {
  await db.$disconnect();
});

const accionDe = (e: EntradasProyeccion, id: string) => e.posiciones.find((p): p is AccionEntrada => p.tipo === "ACCION" && p.instrumentoId === id);
const fondoDe = (e: EntradasProyeccion, id: string) => e.posiciones.find((p): p is FondoEntrada => p.tipo === "FONDO" && p.instrumentoId === id);
const deEstaCorrida = (e: EntradasProyeccion): EntradasProyeccion => ({
  ...e,
  posiciones: e.posiciones.filter((p) => [ids["a"], ids["o"], fondoId, fondoVacioId].includes(p.instrumentoId)),
});
const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 24, aportePeriodico: 371.53, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 7.3, trayectorias: 997, semilla: 4613, ...cambios,
});

describe("leerEntradas", () => {
  it("las acciones vivas con su cantidad y SOLO los cierres vigentes de Yahoo hasta hoy, en orden y exactos", async () => {
    const e = await leerEntradas(db, HOY);
    const a = accionDe(e, ids["a"]!)!;
    expect(a).toMatchObject({ nombre: nemo.a, cantidad: 1237 });
    expect(a.cierres).toHaveLength(421);
    expect(a.cierres.map((c) => c.dia.getTime())).toEqual([...a.cierres.map((c) => c.dia.getTime())].sort((x, y) => x - y));
    expect(a.cierres.find((c) => iso(c.dia) === iso(dias[10]!))!.precio).toBe(Number(precioA(10)));
    expect(a.cierres.find((c) => iso(c.dia) === iso(dias[11]!))!.precio).toBe(Number(precioA(11)));
    expect(a.cierres.some((c) => iso(c.dia) === iso(SABADO))).toBe(true);
    expect(a.cierres.some((c) => iso(c.dia) === "2017-06-14")).toBe(false); // fuera de los 10 años
    expect(a.movimientos).toEqual([{ fecha: dia("2027-12-06"), cantidad: 1237n }]);
  });

  it("dividendos sin la fracción de escisión, decretos con su marca y las escisiones con los cierres del destino", async () => {
    const e = await leerEntradas(db, HOY);
    const a = accionDe(e, ids["a"]!)!;
    expect(a.dividendos).toEqual([
      { fechaPago: dia("2027-12-20"), montoNeto: 733.19, decretadoId: null },
      { fechaPago: dia("2027-12-22"), montoNeto: 47.93, decretadoId: null },
    ]);
    // El del 20 queda fuera de la cota (su ventana termina un día antes del primer día leído).
    expect(a.decretos.some((x) => iso(x.fechaPago) === "2017-12-20")).toBe(false);
    // Solo las versiones vigentes y no anuladas, con su fecha ex y su valor, desde el borde de la cota.
    expect(a.decretos.map((x) => [iso(x.fechaPago), iso(x.fechaEx), x.valorPorAccion, x.recibido])).toEqual([
      ["2017-12-21", "2017-12-14", 2.17, false], ["2020-07-15", "2020-07-08", 3.47, false], ["2027-12-22", "2027-12-15", 0.0391, false], ["2028-04-12", "2028-04-05", 3.13, false],
    ]);
    expect(e.escisiones).toContainEqual({ origenId: ids["o"], destinoId: ids["d"], fecha: EVENTO, razon: 0.37 });
    expect(e.cierresDestino[ids["d"]!]).toHaveLength(120);
    expect(accionDe(e, ids["d"]!)).toBeUndefined();
    expect(e.noHabiles.length).toBeGreaterThan(0);
  });

  it("la fecha ex leída manda en los pagos de Trii: una compra entre la ex y el pago no los saca (la regla del plan)", async () => {
    const a = accionDe(await leerEntradas(db, HOY), ids["a"]!)!;
    // Una compra ficticia el 17, después de la ex del 15 y antes de los dos pagos del grupo del 22 (el 20 y el 22).
    const r = dividendosPorAccion({ ...a, movimientos: [...a.movimientos, { fecha: dia("2027-12-17"), cantidad: 113n }] }, HOY);
    expect(r.pagos.filter((p) => p.origen === "PAGO")).toEqual([
      { dia: "2027-12-20", porAccion: 733.19 / 1237, origen: "PAGO" },
      { dia: "2027-12-22", porAccion: 47.93 / 1237, origen: "PAGO" },
    ]);
    expect(r.avisos.filter((x) => x.codigo.startsWith("DIVIDENDO"))).toEqual([]);
  });

  it("el fondo con sus unidades netas hasta hoy (el retiro resta) y sus valores vigentes; el que no tiene valores también", async () => {
    const e = await leerEntradas(db, HOY);
    const f = fondoDe(e, fondoId)!;
    expect(f).toMatchObject({ nombre: "Fondo ficticio de proyecciones", unidades: 1499.927 });
    expect(f.valores).toHaveLength(640);
    expect(f.valores.find((v) => iso(v.dia) === "2019-03-05")!.valorUnidad).toBe(Number((12731.4419 * 1.00013 ** 75).toFixed(8)));
    expect(fondoDe(e, fondoVacioId)).toMatchObject({ unidades: 7.31, valores: [] });
    expect(fondoDe(e, fondoCeroId)).toBeUndefined(); // unidades netas 0: no es una posición
  });

  it("la especie con ventas sin asignar queda fuera y se nombra", async () => {
    const e = await leerEntradas(db, HOY);
    expect(e.posiciones.some((p) => p.instrumentoId === ids["inc"])).toBe(false);
    expect(e.incompletas).toContain(nemo.inc);
  });
});

describe("la proyección sobre lo leído", () => {
  it("estados, días, dividendos, escisión y fondo cuadran con los datos sembrados", async () => {
    const e = deEstaCorrida(await leerEntradas(db, HOY));
    const r = calcularProyeccion(e, P());
    const pos = (id: string) => r.supuestos.posiciones.find((p) => p.instrumentoId === id)!;
    // El pago de 2027 queda después de la ventana; el decreto de 2020 (sin pago recibido) sí entra, con su aviso.
    expect(pos(ids["a"]!)).toMatchObject({ estado: "PROYECTADA", diasTotales: 420, diasEnVentana: 420, dividendosUsados: 1, primerDividendo: "2020-07-15" });
    expect(pos(ids["o"]!)).toMatchObject({ estado: "PROYECTADA", diasTotales: 420 });
    expect(pos(fondoId)).toMatchObject({ estado: "PROYECTADA", tipo: "FONDO" });
    expect(pos(fondoVacioId)).toMatchObject({ estado: "EXCLUIDA_SIN_VALOR" });
    expect(pos(ids["a"]!).valorHoy).toBeCloseTo(1237 * Number(precioA(419)), 6);
    expect(r.supuestos.ventana).toMatchObject({ desde: iso(dias[0]!), hasta: iso(dias[419]!), ruedas: 420 });
    // Guarda: el aviso de año sin calendario depende de que 2019-2020 sigan sin sembrar en calendario_bvc.
    expect(await db.calendarioBvc.count({ where: { dia: { gte: dia("2019-01-01"), lt: dia("2021-01-01") } } }), "2019-2020 no deben estar sembrados").toBe(0);
    const codigos = r.supuestos.avisos.map((x) => [x.codigo, x.dia ?? x.dato]);
    expect(codigos).toContainEqual(["DECRETO_BRUTO", "2020-07-15"]);
    // El decreto de 2017 se lee (para cruzar los pagos del borde) pero queda antes de la ventana: no entra ni se avisa.
    expect(codigos.filter(([c]) => c === "DECRETO_BRUTO")).toEqual([["DECRETO_BRUTO", "2020-07-15"]]);
    expect(codigos).toContainEqual(["ANIO_SIN_CALENDARIO", 2019]);
    // La escisión de 2027 cae después del último cierre del origen: no mueve ningún retorno de la ventana.
    expect(codigos.some(([c]) => c === "SALTO_SIN_EVENTO" || String(c).startsWith("ESCISION") || String(c).startsWith("DIVIDENDO"))).toBe(false);
    expect(r.supuestos.decretosFuturos).toBe(1);
    expect(r.puntos).toHaveLength(25);
  });

  it("proyectar: valida, lee y simula; el mismo pedido da lo mismo y uno inválido no toca nada", async () => {
    const r1 = await proyectar(db, P(), HOY);
    const r2 = await proyectar(db, P(), HOY);
    expect(r1).toEqual(r2);
    if (!r1.ok) throw new Error("debía proyectar");
    expect(r1.resultado.aviso).toBe("Escenario ilustrativo, no es recomendación ni promesa.");
    expect(r1.resultado.puntos).toHaveLength(25);
    for (const p of r1.resultado.puntos) expect([p.p5, p.p25, p.p50, p.p75, p.p95]).toEqual([p.p5, p.p25, p.p50, p.p75, p.p95].sort((x, y) => x - y));
    expect(await proyectar(db, { ...P(), trayectorias: 0 }, HOY)).toEqual({ ok: false, errores: [{ campo: "trayectorias", codigo: "FUERA_DE_RANGO" }] });
  });
});
