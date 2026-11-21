// Integración de INV-SPEC-8 contra la base de PRUEBAS. Todos los datos son inventados.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { descifrarCrudo, type LlaveFilaFuente } from "@/cifrado/campos";
import { ErrorCifrado } from "@/cifrado/errores";
import { esSobre } from "@/cifrado/sobre";
import { importarArchivoTrii } from "@/importacion/trii/importar";

const db = new PrismaClient();
let duenoId = "";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
// Nemotécnicos únicos por corrida: las filas importadas no se borran entre pruebas.
const nemo = (base: string) => `${base}${corrida}`.replace(/[^A-Z0-9]/g, "").slice(0, 20);

const fixture = (nombre: string) => readFileSync(fileURLToPath(new URL(`../fixtures/trii/${nombre}`, import.meta.url)));
const csv = (texto: string) => new TextEncoder().encode(texto);
const importar = (nombreArchivo: string, contenido: Uint8Array, usuarioId = duenoId) =>
  importarArchivoTrii(db, { nombreArchivo, contenido, usuarioId });

const CAJA = "Fecha y hora,Tipo de movimiento,Estado,Valor total\n";
const ORDENES =
  "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const DIVIDENDOS = "Fecha y hora,Ticker,Estado,Valor total\n";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-imp-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

/** La llave (AAD) de una fila_fuente: el sobre de su crudo solo abre con ella. */
const llaveDe = (f: { tipoFuente: string; claveNatural: string; ocurrencia: number }): LlaveFilaFuente => ({
  tipoFuente: f.tipoFuente, claveNatural: f.claveNatural, ocurrencia: f.ocurrencia,
});

describe("importar los fixtures de Trii", () => {
  it("carga caja, órdenes y dividendos, con trazabilidad hasta archivo y fila", async () => {
    const caja = await importar("caja.ficticio.csv", fixture("caja.ficticio.csv"));
    expect(caja).toMatchObject({ estado: "CARGADO", tipo: "TRII_CAJA", filasTotal: 4, filasNuevas: 4, filasRepetidas: 0 });

    const ordenes = await importar("ordenes.ficticio.csv", fixture("ordenes.ficticio.csv"));
    expect(ordenes).toMatchObject({ estado: "CARGADO", tipo: "TRII_ORDENES", filasNuevas: 3 });

    const dividendos = await importar("dividendos.ficticio.csv", fixture("dividendos.ficticio.csv"));
    expect(dividendos).toMatchObject({ estado: "CARGADO", tipo: "TRII_DIVIDENDOS", filasNuevas: 3 });

    const venta = await db.orden.findFirst({ where: { lado: "VENTA", filaFuente: { primeraCargaId: ordenes.cargaId } }, include: { filaFuente: true } });
    expect(venta?.filaFuente.primeraFilaNo).toBe(4);
    expect(descifrarCrudo(venta!.filaFuente.crudo, llaveDe(venta!.filaFuente))["Tipo de orden"]).toBe("Venta");
    // 13-nov-2024 (miércoles) + 2 hábiles = 15-nov-2024 (viernes).
    expect(venta?.fechaLiquidacion.toISOString().slice(0, 10)).toBe("2024-11-15");
  });

  it("dos filas idénticas legítimas en el mismo archivo quedan como dos hechos", async () => {
    const monto = `${Date.now() % 100000}.25`;
    const fila = `"7 mar 2026, 8:00 a. m.",Depósito,Aprobado,${monto}\n`;
    const r = await importar("dobles.ficticio.csv", csv(`${CAJA}${fila}${fila}`));
    expect(r).toMatchObject({ estado: "CARGADO", filasNuevas: 2 });
    const filas = await db.filaFuente.findMany({ where: { primeraCargaId: r.cargaId } });
    expect(filas.map((f) => f.ocurrencia).sort()).toEqual([1, 2]);
  });
});

describe("reimportar no duplica", () => {
  it("el mismo archivo otra vez: 0 filas nuevas y la carga deja constancia de lo que vio", async () => {
    const n = nemo("RE");
    const contenido = csv(`${DIVIDENDOS}2026-01-21,${n},,100.0\n2026-04-15,${n},,110.0\n`);
    const primera = await importar("div-a.ficticio.csv", contenido);
    const segunda = await importar("div-a.ficticio.csv", contenido);
    expect(primera.filasNuevas).toBe(2);
    expect(segunda).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 2 });
    expect(await db.dividendo.count({ where: { instrumento: { nemotecnico: n } } })).toBe(2);
    expect(await db.filaDeCarga.count({ where: { cargaId: segunda.cargaId } })).toBe(2);
  });

  it("una exportación solapada solo suma las filas nuevas", async () => {
    const n = nemo("SO");
    await importar("div-1.ficticio.csv", csv(`${DIVIDENDOS}2026-01-21,${n},,100.0\n`));
    const solapada = await importar("div-2.ficticio.csv", csv(`${DIVIDENDOS}2026-01-21,${n},,100.0\n2026-04-15,${n},,110.0\n`));
    expect(solapada).toMatchObject({ filasNuevas: 1, filasRepetidas: 1 });
    expect(await db.dividendo.count({ where: { instrumento: { nemotecnico: n } } })).toBe(2);
  });

  it("el instrumento se crea una sola vez entre cargas", async () => {
    const n = nemo("IN");
    const a = await importar("i1.ficticio.csv", csv(`${DIVIDENDOS}2026-02-09,${n},,5.0\n`));
    const b = await importar("i2.ficticio.csv", csv(`${DIVIDENDOS}2026-05-02,${n},,6.0\n`));
    expect([a.instrumentosCreados, b.instrumentosCreados]).toEqual([1, 0]);
    expect(await db.instrumento.count({ where: { nemotecnico: n } })).toBe(1);
  });
});

describe("precisión y forma de los números", () => {
  it("«1500» y luego «1500.0» del mismo movimiento no duplican", async () => {
    const monto = 1000 + (Date.now() % 1000);
    const fila = (m: string) => `${CAJA}"8 mar 2026, 9:00 a. m.",Depósito,Aprobado,${m}\n`;
    expect((await importar("e1.ficticio.csv", csv(fila(`${monto}`)))).filasNuevas).toBe(1);
    expect(await importar("e2.ficticio.csv", csv(fila(`${monto}.0`)))).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 1 });
  });

  it("más decimales que la columna se rechazan (no se redondea en silencio) y no bloquean reimportaciones", async () => {
    const n = nemo("PR");
    const r = await importar("p.ficticio.csv", csv(`${ORDENES}"11 feb 2026, 10:00 a. m.",${n},Compra,Aprobado,3,0,33.3333333,100.00005,1.0,101.00005\n`));
    expect(r.estado).toBe("RECHAZADO");
    expect(r.errores.map((e) => e.codigo)).toEqual(["NUMERO_PRECISION", "NUMERO_PRECISION", "NUMERO_PRECISION"]);
    const exacto = csv(`${ORDENES}"11 feb 2026, 10:00 a. m.",${n},Compra,Aprobado,3,0,33.333333,99.999999,1.0,100.999999\n`);
    expect((await importar("p2.ficticio.csv", exacto)).errores[0]?.codigo).toBe("NUMERO_PRECISION");
  });

  it("dos órdenes del mismo minuto, especie y lado se reimportan sin conflicto", async () => {
    const n = nemo("MM");
    const archivo = csv(
      `${ORDENES}"12 feb 2026, 10:00 a. m.",${n},Compra,Aprobado,5,0,10.0,50.0,1.0,51.0\n"12 feb 2026, 10:00 a. m.",${n},Compra,Aprobado,7,0,10.0,70.0,1.0,71.0\n`,
    );
    expect((await importar("mm1.ficticio.csv", archivo)).filasNuevas).toBe(2);
    expect(await importar("mm2.ficticio.csv", archivo)).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 2 });
  });
});

describe("rechazo atómico", () => {
  it("una fila inválida al final rechaza el archivo entero y no guarda ningún hecho ni valor", async () => {
    const n = nemo("AT");
    const r = await importar("malo.ficticio.csv", csv(`${DIVIDENDOS}2026-03-01,${n},,700.0\n2026-03-02,${n},,700.0\n2026-02-30,${n},,99999.0\n`));
    expect(r).toMatchObject({ estado: "RECHAZADO", filasNuevas: 0 });
    expect(r.errores).toEqual([{ fila: 4, columna: "Fecha y hora", codigo: "FECHA_INVALIDA" }]);
    expect(await db.instrumento.count({ where: { nemotecnico: n } })).toBe(0);
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId } });
    expect(carga.estado).toBe("RECHAZADO");
    expect(JSON.stringify(carga.errores)).not.toMatch(/99999|700/);
  });

  it("un archivo que no es de Trii se rechaza por su encabezado", async () => {
    const r = await importar("otro.ficticio.csv", csv("a,b\n1,2\n"));
    expect(r).toMatchObject({ estado: "RECHAZADO", tipo: null, errores: [{ fila: 1, columna: null, codigo: "ENCABEZADO_DESCONOCIDO" }] });
  });

  it("un archivo que no es UTF-8 se rechaza", async () => {
    const r = await importar("latin1.ficticio.csv", new Uint8Array([0x46, 0x65, 0x63, 0x68, 0xe1, 0x0a]));
    expect(r.errores[0]?.codigo).toBe("CODIFICACION_NO_UTF8");
  });

  it("la misma fila con otro estado es un conflicto: se rechaza y no se edita lo importado", async () => {
    const n = nemo("CF");
    const fila = (estado: string, comision: string) => `"10 feb 2026, 10:00 a. m.",${n},Compra,${estado},10,0,100.0,1000.0,${comision},1010.0\n`;
    expect((await importar("o1.ficticio.csv", csv(`${ORDENES}${fila("Aprobado", "10.0")}`))).estado).toBe("CARGADO");
    const otroEstado = await importar("o2.ficticio.csv", csv(`${ORDENES}${fila("Cancelado", "10.0")}`));
    expect(otroEstado).toMatchObject({ estado: "RECHAZADO", errores: [{ fila: 2, codigo: "CONFLICTO_ESTADO" }] });
    const otraComision = await importar("o3.ficticio.csv", csv(`${ORDENES}${fila("Aprobado", "12.0")}`));
    expect(otraComision.errores[0]?.codigo).toBe("CONFLICTO_COMISION");
    const orden = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: n } } });
    expect(orden.estado).toBe("APROBADO");
  });

  it("una orden de un año sin calendario de la BVC sembrado se rechaza (no inventa la fecha T+2)", async () => {
    const r = await importar("o-2030.ficticio.csv", csv(`${ORDENES}"10 feb 2030, 10:00 a. m.",${nemo("CA")},Compra,Aprobado,1,0,100.0,100.0,1.0,101.0\n`));
    expect(r.errores[0]?.codigo).toBe("CALENDARIO_BVC_INCOMPLETO");
  });

  it("una orden de 2023 liquida con el calendario sembrado (INV-SPEC-9)", async () => {
    // Viernes 17-mar-2023 + 2 hábiles: lunes 20 es San José → martes 21 y miércoles 22.
    const n = nemo("23");
    const r = await importar("o-2023.ficticio.csv", csv(`${ORDENES}"17 mar 2023, 10:00 a. m.",${n},Compra,Aprobado,1,0,100.0,100.0,1.0,101.0\n`));
    expect(r.estado).toBe("CARGADO");
    const orden = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: n } } });
    expect(orden.fechaLiquidacion.toISOString().slice(0, 10)).toBe("2023-03-22");
  });

  it("la liquidación T+2 salta festivos y fines de semana", async () => {
    // Miércoles 16-abr-2025 + 2 hábiles: jueves y viernes santos y el fin de semana → martes 22-abr.
    const n = nemo("T2");
    await importar("o-t2.ficticio.csv", csv(`${ORDENES}"16 abr 2025, 10:00 a. m.",${n},Compra,Aprobado,1,0,100.0,100.0,1.0,101.0\n`));
    const orden = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: n } } });
    expect(orden.fechaLiquidacion.toISOString().slice(0, 10)).toBe("2025-04-22");
  });
});

describe("permisos y fracciones", () => {
  it("solo el dueño activo puede importar", async () => {
    const familia = await db.usuario.create({ data: { email: `familia-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } });
    await expect(importar("x.ficticio.csv", csv(`${DIVIDENDOS}2026-01-01,${nemo("FA")},,1.0\n`), familia.id)).rejects.toThrow(/USUARIO_NO_AUTORIZADO/);
  });

  it("un pago que coincide con la fracción de un evento de escisión se marca como fracción, no como dividendo", async () => {
    const origen = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("ORI"), nombre: "Origen ficticio" } });
    const destino = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("DES"), nombre: "Destino ficticio" } });
    const evento = await db.eventoCorporativo.create({
      data: { tipo: "ESCISION", fecha: new Date("2024-02-26"), origenId: origen.id, destinoId: destino.id, fechaPagoFraccion: new Date("2024-03-08"), nota: "por confirmar con el extracto de A&V" },
    });
    await importar("frac.ficticio.csv", csv(`${DIVIDENDOS}2024-03-08,${destino.nemotecnico},,4321.0\n2024-04-15,${destino.nemotecnico},,50.0\n`));
    const [fraccion, ordinario] = await db.dividendo.findMany({ where: { instrumentoId: destino.id }, orderBy: { fechaPago: "asc" } });
    expect(fraccion).toMatchObject({ tipo: "FRACCION_ESCISION", eventoId: evento.id });
    expect(ordinario).toMatchObject({ tipo: "ORDINARIO", eventoId: null });
  });
});

describe("cifrado del crudo (#11)", () => {
  afterEach(() => vi.unstubAllEnvs());

  const archivoOrdenes = (n: string) =>
    csv(`${ORDENES}"14 feb 2026, 10:00 a. m.",${n},Compra,Aprobado,4,0,25.5,102.0,1.25,103.25\n"14 feb 2026, 11:00 a. m.",${n},Venta,Aprobado,2,0,26.75,53.5,1.25,52.25\n`);

  it("crudo queda como sobre, la base no tiene los valores en claro y descifrar devuelve la fila tal cual vino", async () => {
    const n = nemo("CI");
    const r = await importar("ci.ficticio.csv", archivoOrdenes(n));
    expect(r).toMatchObject({ estado: "CARGADO", filasNuevas: 2 });
    const filas = await db.filaFuente.findMany({ where: { primeraCargaId: r.cargaId }, orderBy: { primeraFilaNo: "asc" } });
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      expect(esSobre(f.crudo)).toBe(true);
      expect((f.crudo as { kid: string }).kid).toBe(process.env.CIFRADO_CLAVE_ACTIVA);
    }
    const texto = await db.$queryRaw<{ t: string }[]>`SELECT crudo::text AS t FROM fila_fuente WHERE "primeraCargaId" = ${r.cargaId}`;
    for (const { t } of texto) expect(t).not.toMatch(new RegExp(`${n}|Compra|Venta|102\\.0|26\\.75|14 feb 2026`));
    expect(descifrarCrudo(filas[1]!.crudo, llaveDe(filas[1]!))).toEqual({
      "Fecha y hora": "14 feb 2026, 11:00 a. m.", "Símbolo de la acción": n, "Tipo de orden": "Venta", Estado: "Aprobado",
      "Acciones completadas": "2", "Acciones pendientes": "0", "Precio por acción": "26.75", "Total invertido": "53.5",
      "Valor comisión": "1.25", "Total estimado": "52.25",
    });
  });

  it("los montos y cantidades en sus columnas NO se cifran", async () => {
    const n = nemo("MO");
    await importar("mo.ficticio.csv", archivoOrdenes(n));
    const compra = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: n }, lado: "COMPRA" } });
    expect(compra.totalInvertido.toString()).toBe("102");
    expect(compra.cantidadCompletada).toBe(4n);
  });

  it("reimportar el mismo archivo no duplica: la clave natural se calcula antes de cifrar y el sobre guardado no se reescribe", async () => {
    const n = nemo("RC");
    const primera = await importar("rc-1.ficticio.csv", archivoOrdenes(n));
    const antes = await db.filaFuente.findMany({ where: { primeraCargaId: primera.cargaId }, orderBy: { id: "asc" } });
    const segunda = await importar("rc-2.ficticio.csv", archivoOrdenes(n));
    expect(segunda).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 2 });
    expect(await db.orden.count({ where: { instrumento: { nemotecnico: n } } })).toBe(2);
    const despues = await db.filaFuente.findMany({ where: { id: { in: antes.map((f) => f.id) } }, orderBy: { id: "asc" } });
    expect(despues.map((f) => f.crudo)).toEqual(antes.map((f) => f.crudo));
  });

  it.each([
    ["sin la activa", { CIFRADO_CLAVE_ACTIVA: "" }, "CLAVE_ACTIVA_AUSENTE"],
    ["la activa sin su clave", { CIFRADO_CLAVE_ACTIVA: "v9" }, "CLAVE_AUSENTE"],
  ])("%s: lanza ErrorCifrado antes de tocar la base; no queda ni la carga RECHAZADA", async (_caso, entorno, codigo) => {
    for (const [k, v] of Object.entries(entorno)) vi.stubEnv(k, v);
    const nombre = `sin-clave-${codigo}-${corrida}.ficticio.csv`;
    const intento = importar(nombre, archivoOrdenes(nemo("SC")));
    await expect(intento).rejects.toBeInstanceOf(ErrorCifrado);
    await expect(intento).rejects.toMatchObject({ codigo });
    // Ni siquiera un CSV inválido deja registro sin clave.
    await expect(importar(nombre, csv("a,b\n1,2\n"))).rejects.toMatchObject({ codigo });
    expect(await db.cargaArchivo.count({ where: { nombreArchivo: nombre } })).toBe(0);
  });
});

// Bordes del archivo (hueco de pruebas): lo que no trae datos se rechaza con su código y deja la carga
// registrada; un archivo con CRLF y BOM se lee igual que uno con LF.
describe("bordes del CSV", () => {
  const CRLF = (texto: string) => texto.replaceAll("\n", "\r\n");

  it("un archivo vacío se rechaza por su encabezado y la carga queda registrada sin filas", async () => {
    const r = await importar("vacio.ficticio.csv", csv(""));
    expect(r).toMatchObject({ estado: "RECHAZADO", tipo: null, filasTotal: 0, errores: [{ fila: 1, columna: null, codigo: "ENCABEZADO_DESCONOCIDO" }] });
    expect(await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId } })).toMatchObject({ estado: "RECHAZADO", filasTotal: 0 });
  });

  it("solo el encabezado: ARCHIVO_SIN_FILAS, con su tipo reconocido", async () => {
    const r = await importar("solo-encabezado.ficticio.csv", csv(DIVIDENDOS));
    expect(r).toMatchObject({ estado: "RECHAZADO", tipo: "TRII_DIVIDENDOS", filasTotal: 0, errores: [{ fila: 0, columna: null, codigo: "ARCHIVO_SIN_FILAS" }] });
  });

  it("el encabezado y líneas en blanco al final (BOM y CRLF) también es ARCHIVO_SIN_FILAS", async () => {
    const r = await importar("blancas.ficticio.csv", csv(`﻿${CRLF(`${CAJA}\n\n`)}`));
    expect(r).toMatchObject({ estado: "RECHAZADO", tipo: "TRII_CAJA", errores: [{ fila: 0, columna: null, codigo: "ARCHIVO_SIN_FILAS" }] });
  });

  it("el mismo archivo con BOM y CRLF se lee igual que con LF: sus filas salen repetidas, no nuevas", async () => {
    const n = nemo("CR");
    const filas = `${DIVIDENDOS}2026-01-21,${n},,100.0\n2026-04-15,${n},,110.5\n`;
    expect(await importar("lf.ficticio.csv", csv(filas))).toMatchObject({ estado: "CARGADO", filasNuevas: 2 });
    expect(await importar("crlf.ficticio.csv", csv(`﻿${CRLF(filas)}`))).toMatchObject({ estado: "CARGADO", filasNuevas: 0, filasRepetidas: 2 });
    expect(await db.dividendo.count({ where: { instrumento: { nemotecnico: n } } })).toBe(2);
  });

  it("una comilla sin cerrar rechaza el archivo con COMILLA_SIN_CERRAR y no guarda ningún hecho", async () => {
    const n = nemo("CO");
    const r = await importar("comilla.ficticio.csv", csv(`${CAJA}"9 mar 2026, 8:00 a. m.,Depósito,Aprobado,1.0\n${DIVIDENDOS}2026-01-21,${n},,1.0\n`));
    expect(r).toMatchObject({ estado: "RECHAZADO", tipo: null, filasTotal: 0, errores: [{ fila: 0, columna: null, codigo: "COMILLA_SIN_CERRAR" }] });
    expect(await db.instrumento.count({ where: { nemotecnico: n } })).toBe(0);
  });
});
