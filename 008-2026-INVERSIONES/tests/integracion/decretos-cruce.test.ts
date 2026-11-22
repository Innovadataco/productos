// El lector de decretos (fase C, C5b: src/datos-oficiales/decretos/leer.ts) contra la base de PRUEBAS: el cruce lee
// solo los decretos vigentes y no anulados (una corrección retira a la v1; una anulación es una versión `anulada`), la
// tenencia de las órdenes de Trii (por operación, al cierre del día anterior a la ex), los pagos de Trii sin las
// fracciones de escisión y la cobertura de las cargas; un pago suelto es SIN_DECRETO; los próximos salen en orden.
// La base se comparte con los demás archivos: todo se filtra por las especies de esta corrida.
// Datos INVENTADOS y cifras raras. Órdenes, dividendos y decretos en diciembre de 2027 (el año sembrado: el importador
// de Trii exige el calendario; nunca antes de 2023, por la guarda de conciliacion.test.ts), como proyecciones.test.ts.
// Sin cierres (moverían la fecha de referencia del tablero).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import type { FilaCruce } from "@/datos-oficiales/decretos/cruce";
import { importarDecretos } from "@/datos-oficiales/decretos/importar";
import { coberturaTrii, leerCruce, leerProximos } from "@/datos-oficiales/decretos/leer";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { fechaEnBogota } from "@/precios/horario";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = { a: `CA${corrida}`, b: `CB${corrida}`, z: `CZ${corrida}` };
const email = `dueno-cruce-${corrida}@ejemplo.invalid`;
const HOY = new Date("2027-12-31T00:00:00Z");
const AHORA = new Date("2027-12-31T15:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const bytes = (t: string) => new TextEncoder().encode(t);
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const DIV = "Fecha y hora,Ticker,Estado,Valor total\n";
const REF = "https://www.bvc.com.co/ficticio/c5b";
const ids: Record<string, string> = {};
let antesDeCargar = new Date();

/** especie,tipo,fecha_anuncio,cuota,valor_por_accion,moneda,forma,fecha_ex,fecha_pago,referencia,anulada,nota */
const decreto = (especie: string, tipo: string, cuota: number, valor: string, ex: string, pago: string, anulada = "", nota = "", anuncio = "2027-11-17") =>
  [especie, tipo, anuncio, String(cuota), valor, "COP", "DINERO", ex, pago, `${REF}-${cuota}`, anulada, nota].join(",");
async function registrar(filas: readonly string[]): Promise<void> {
  const r = await importarDecretos(db, { contenido: bytes(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.join("\n")}\n`), email, aplicar: true }, { ahora: AHORA });
  if (r.estado !== "APLICADO") throw new Error(`no se registraron los decretos: ${JSON.stringify(r)}`);
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
  const imp = (nombre: string, t: string) => importarArchivoTrii(db, { nombreArchivo: nombre, contenido: bytes(t), usuarioId: duenoId });
  antesDeCargar = new Date();
  // A: 1237 antes de la ex del 9-dic y 311 EL MISMO DÍA de la ex (no cuentan para ese decreto, sí para el del 22-dic).
  await imp("o.ficticio.csv", ORD + [
    `"2 dic 2027, 10:00 a. m.",${nemo.a},Compra,Aprobado,1237,0,10.37,12827.69,7.13,12834.82`,
    `"9 dic 2027, 10:00 a. m.",${nemo.a},Compra,Aprobado,311,0,10.41,3237.51,7.13,3244.64`,
    `"2 dic 2027, 10:00 a. m.",${nemo.b},Compra,Aprobado,97,0,23.71,2299.87,7.13,2307.00`,
  ].join("\n") + "\n");
  ids["a"] = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo.a } })).id;
  ids["b"] = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo.b } })).id;
  const z = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo.z, nombre: "Origen ficticio de una fracción" } });
  // Una fracción de escisión pagada sobre A dentro de la ventana del decreto del 27-dic: no es un dividendo.
  await db.eventoCorporativo.create({ data: { tipo: "ESCISION", fecha: dia("2027-12-09"), origenId: z.id, destinoId: ids["a"]!, fechaPagoFraccion: dia("2027-12-29") } });
  await imp("d.ficticio.csv", `${DIV}2027-12-16,${nemo.a},,4613.27\n2027-12-29,${nemo.a},,41.37\n2027-12-21,${nemo.b},,37.91\n`);

  await registrar([
    decreto(nemo.a, "ORDINARIO", 1, "4.917311", "2027-12-09", "2027-12-14"),
    decreto(nemo.a, "EXTRAORDINARIO", 1, "1.371937", "2027-12-09", "2027-12-14"),
    decreto(nemo.a, "ORDINARIO", 2, "3.719413", "2027-12-22", "2027-12-27"),
    decreto(nemo.a, "ORDINARIO", 3, "2.613719", "2028-01-12", "2028-01-19", "", "", "2027-12-15"),
    decreto(nemo.b, "ORDINARIO", 1, "1.374113", "2028-01-05", "2028-01-11", "", "", "2027-12-15"),
    decreto(nemo.b, "EXTRAORDINARIO", 1, "0.971313", "2028-01-26", "2028-02-02", "", "", "2027-12-15"),
  ]);
  // Una corrección (v2 vigente, retira a la v1) y dos anulaciones (versión `anulada`): ni la v1 ni las anuladas se leen.
  await registrar([
    decreto(nemo.a, "ORDINARIO", 1, "4.291731", "2027-12-09", "2027-12-14"),
    decreto(nemo.a, "EXTRAORDINARIO", 1, "1.371937", "2027-12-09", "2027-12-14", "SI", "anulado en la prueba"),
    decreto(nemo.b, "EXTRAORDINARIO", 1, "0.971313", "2028-01-26", "2028-02-02", "SI", "anulado en la prueba", "2027-12-15"),
  ]);
});

afterAll(async () => {
  await db.$disconnect();
});

const deEstaCorrida = (filas: readonly FilaCruce[]) => filas.filter((f) => f.instrumentoId === ids["a"] || f.instrumentoId === ids["b"]);
const fijo = (d: { toFixed(n: number): string } | null) => (d === null ? null : d.toFixed(6));

describe("leerCruce", () => {
  it("la cobertura es el día (en Colombia) de la última carga de Trii de órdenes y de dividendos", async () => {
    const cubierto = await coberturaTrii(db);
    expect([fechaEnBogota(antesDeCargar).getTime(), fechaEnBogota(new Date()).getTime()]).toContain(cubierto?.getTime());
  });

  it("los decretos vigentes y no anulados con la tenencia antes de la ex, los pagos sin la fracción y el pago suelto", async () => {
    const cubierto = await coberturaTrii(db);
    const r = await leerCruce(db, HOY, dia("2027-12-01"));
    const filas = deEstaCorrida(r.filas);
    expect(filas.map((f) => `${iso(f.fechaPago)} ${f.instrumentoId === ids["a"] ? "A" : "B"} ${f.estado}`)).toEqual([
      `2027-12-14 A ${cubierto !== null && cubierto >= dia("2027-12-09") ? "RECIBIDO" : "REVISAR"}`,
      "2027-12-21 B SIN_DECRETO",
      "2027-12-27 A PENDIENTE",
    ]);
    const [recibido, suelto, pendiente] = filas;
    // La v2 (4.291731) por las 1237 de antes de la ex; la v1 retirada y el extraordinario anulado no entran.
    expect(recibido!.decretos.map((d) => [d.tipo, d.cuota, fijo(d.valorPorAccion), d.tenenciaAntesDeLaEx])).toEqual([["ORDINARIO", 1, "4.291731", 1237n]]);
    expect([fijo(recibido!.brutoEsperado), fijo(recibido!.netoRecibido), fijo(recibido!.diferenciaBrutoNeto)]).toEqual(["5308.871247", "4613.270000", "695.601247"]);
    expect(recibido!.pagos.map((p) => iso(p.fechaPago))).toEqual(["2027-12-16"]);
    // Con la cobertura de hoy (las cargas son de esta corrida, antes de 2027-12), la ex no está cubierta: se dice.
    expect(recibido!.motivos).toEqual(cubierto !== null && cubierto >= dia("2027-12-09") ? [] : ["CARGA_NO_CUBRE_LA_EX"]);
    expect([suelto!.pagos.map((p) => fijo(p.montoNeto)), suelto!.decretos, suelto!.brutoEsperado]).toEqual([["37.910000"], [], null]);
    // El del 27-dic: 1237 + 311 antes de su ex; la fracción del 29-dic (en su ventana) no cuenta como pago.
    expect(pendiente!.pagos).toEqual([]);
    expect(pendiente!.decretos[0]!.tenenciaAntesDeLaEx).toBe(1548n);
    expect(fijo(pendiente!.brutoEsperado)).toBe("5757.651324");
    expect(r.sinTenencia.filter((s) => s.instrumentoId === ids["a"] || s.instrumentoId === ids["b"])).toEqual([]);
  });

  it("desde filtra la salida: desde el 15-dic ya no sale el decreto del 14-dic (ni su pago)", async () => {
    const r = await leerCruce(db, HOY, dia("2027-12-15"));
    expect(deEstaCorrida(r.filas).map((f) => iso(f.fechaPago))).toEqual(["2027-12-21", "2027-12-27"]);
  });
});

describe("leerProximos", () => {
  it("los vigentes y no anulados con ex ≥ hoy, en orden de ex, con la tenencia de hoy y el bruto estimado", async () => {
    const r = (await leerProximos(db, HOY)).filter((p) => p.instrumentoId === ids["a"] || p.instrumentoId === ids["b"]);
    expect(r.map((p) => [p.nemotecnico, iso(p.fechaEx), p.cuota, p.version, p.tenencia, fijo(p.brutoEstimado)])).toEqual([
      [nemo.b, "2028-01-05", 1, 1, 97n, "133.288961"],
      [nemo.a, "2028-01-12", 3, 1, 1548n, "4046.037012"],
    ]);
    expect(r[0]).toMatchObject({ tipo: "ORDINARIO", referenciaOficial: `${REF}-1`, fechaPago: dia("2028-01-11"), fechaAnuncio: dia("2027-12-15") });
  });
});
