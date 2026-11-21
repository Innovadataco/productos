// Valor de unidad del FIC desde la SFC (qhpu-8ixx) contra la base de PRUEBAS, con una SFC falsa (sin red).
// Todos los datos son inventados: códigos de negocio de prueba, clases 90x y cifras redondas.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarFondo } from "@/fondo/actualizar";
import { ErrorRegistroFondo, registrarFondo } from "@/fondo/registrar";
import { FUENTE_SFC, type BuscarSfc } from "@/fondo/sfc";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-6);
let n = 0;
const nuevoCodigo = () => `9${corrida}${String((n += 1)).padStart(2, "0")}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const desde = dia("2024-03-10");
const hasta = dia("2024-03-12");
const HOY = dia("2024-03-12");

type Fila = Record<string, string>;
const fila = (codigo: string, fecha: string, valor: string, clase = "901", fondo = "500000000"): Fila => ({
  fecha_corte: `${fecha}T00:00:00.000`, codigo_negocio: codigo, tipo_participacion: clase, valor_unidad_operaciones: valor, valor_fondo_cierre_dia_t: fondo,
});
const serie = (codigo: string, valores: readonly string[], clase = "901") =>
  ["2024-03-10", "2024-03-11", "2024-03-12"].slice(0, valores.length).map((f, i) => fila(codigo, f, valores[i]!, clase));

/** SFC falsa: responde por código de negocio y, como Socrata, filtra por tipo_participacion si se pide. */
function sfcFalsa(respuestas: Record<string, readonly Fila[] | number>) {
  const urls: string[] = [];
  const buscar: BuscarSfc = async (url) => {
    urls.push(url);
    const p = new URL(url).searchParams;
    const r = respuestas[p.get("codigo_negocio") ?? ""] ?? [];
    if (typeof r === "number") return new Response("{}", { status: r });
    const clase = p.get("tipo_participacion");
    return new Response(JSON.stringify(clase ? r.filter((f) => f.tipo_participacion === clase) : r));
  };
  return { buscar, urls };
}

const crearFondo = async (codigo = nuevoCodigo(), activo = true) =>
  (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: codigo, nombre: "Fondo ficticio", activo } })).id;
const vigentes = (fondoId: string) => db.valorUnidadFondo.findMany({ where: { fondoId, reemplazadoEn: null }, orderBy: { fechaValor: "asc" } });
const codigoDe = async (id: string) => (await db.instrumento.findUniqueOrThrow({ where: { id } })).codigoFic!;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("actualizarFondo · versionado", () => {
  let fondoId = "";
  let codigo = "";
  beforeAll(async () => {
    fondoId = await crearFondo();
    codigo = await codigoDe(fondoId);
  });

  it("guarda los valores nuevos con la fuente de la SFC", async () => {
    const { buscar } = sfcFalsa({ [codigo]: serie(codigo, ["10000", "10001", "10002"]) });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [fondoId] });
    expect(r).toMatchObject({ fondos: 1, valoresNuevos: 3, valoresRevisados: 0, fallidos: [] });
    const v = await vigentes(fondoId);
    expect(v.map((x) => [x.fechaValor.toISOString().slice(0, 10), x.valorUnidad.toString(), x.valorFondo?.toString(), x.fuente])).toEqual([
      ["2024-03-10", "10000", "500000000", FUENTE_SFC],
      ["2024-03-11", "10001", "500000000", FUENTE_SFC],
      ["2024-03-12", "10002", "500000000", FUENTE_SFC],
    ]);
    expect(r.ultimos).toEqual([{ instrumentoId: fondoId, ultimaFecha: hasta, atrasado: false }]);
  });

  it("repetir con los mismos valores no cambia nada", async () => {
    const { buscar } = sfcFalsa({ [codigo]: serie(codigo, ["10000", "10001", "10002"]) });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [fondoId] });
    expect(r).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0, fallidos: [] });
    expect(await db.valorUnidadFondo.count({ where: { fondoId } })).toBe(3);
  });

  it("un valor de unidad revisado por la SFC reemplaza al vigente y el viejo queda como historia", async () => {
    const { buscar } = sfcFalsa({ [codigo]: serie(codigo, ["10000", "10001.5", "10002"]) });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [fondoId] });
    expect(r).toMatchObject({ valoresNuevos: 0, valoresRevisados: 1 });
    expect((await vigentes(fondoId)).map((x) => x.valorUnidad.toString())).toEqual(["10000", "10001.5", "10002"]);
    const historia = await db.valorUnidadFondo.findMany({ where: { fondoId, reemplazadoEn: { not: null } } });
    expect(historia.map((x) => x.valorUnidad.toString())).toEqual(["10001"]);
  });

  it("si solo cambia el valor del fondo, también es una revisión", async () => {
    const filas = serie(codigo, ["10000", "10001.5", "10002"]).map((f, i) => (i === 0 ? { ...f, valor_fondo_cierre_dia_t: "600000000" } : f));
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfcFalsa({ [codigo]: filas }).buscar, instrumentoIds: [fondoId] });
    expect(r.valoresRevisados).toBe(1);
    expect((await vigentes(fondoId))[0]!.valorFondo?.toString()).toBe("600000000");
  });

  it("si la SFC no trae el valor del fondo, no se pierde el que ya estaba", async () => {
    const filas = serie(codigo, ["10000", "10001.5", "10002"]).map((f) => ({ ...f, valor_fondo_cierre_dia_t: "" }));
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfcFalsa({ [codigo]: filas }).buscar, instrumentoIds: [fondoId] });
    expect(r).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0 });
    expect((await vigentes(fondoId))[0]!.valorFondo?.toString()).toBe("600000000");
  });
});

describe("actualizarFondo · clase y fallos", () => {
  it("con la clase registrada en SimboloPrecio, pide y guarda solo esa clase", async () => {
    const codigo = nuevoCodigo();
    const { instrumentoId } = await registrarFondo(db, { codigo, participacion: "902", nombre: "Fondo ficticio" }, HOY);
    const { buscar, urls } = sfcFalsa({ [codigo]: [...serie(codigo, ["10000"], "901"), ...serie(codigo, ["20000"], "902")] });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [instrumentoId] });
    expect(r).toMatchObject({ valoresNuevos: 1, fallidos: [] });
    expect(new URL(urls[0]!).searchParams.get("tipo_participacion")).toBe("902");
    expect((await vigentes(instrumentoId)).map((x) => x.valorUnidad.toString())).toEqual(["20000"]);
  });

  it("sin clase registrada y con varias clases, no guarda nada y lo informa", async () => {
    const fondoId = await crearFondo();
    const codigo = await codigoDe(fondoId);
    const { buscar } = sfcFalsa({ [codigo]: [...serie(codigo, ["10000"], "901"), ...serie(codigo, ["20000"], "902")] });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [fondoId] });
    expect(r.fallidos).toEqual([{ instrumentoId: fondoId, codigo: "SFC_VARIAS_PARTICIPACIONES", guardados: 0, conError: 0, descartados: 0 }]);
    expect(await db.valorUnidadFondo.count({ where: { fondoId } })).toBe(0);
  });

  it("un fondo con la SFC caída no aborta a los demás y no escribe nada", async () => {
    const caido = await crearFondo();
    const sano = await crearFondo();
    const [codigoCaido, codigoSano] = [await codigoDe(caido), await codigoDe(sano)];
    const { buscar } = sfcFalsa({ [codigoCaido]: 503, [codigoSano]: serie(codigoSano, ["10000", "10001"]) });
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [caido, sano] });
    expect(r).toMatchObject({ fondos: 2, valoresNuevos: 2 });
    expect(r.fallidos).toEqual([{ instrumentoId: caido, codigo: "SFC_HTTP_503", guardados: 0, conError: 0, descartados: 0 }]);
    expect(await db.valorUnidadFondo.count({ where: { fondoId: caido } })).toBe(0);
  });

  it("un valor inválido de su clase se descarta, los demás se guardan y se informa", async () => {
    const fondoId = await crearFondo();
    const codigo = await codigoDe(fondoId);
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfcFalsa({ [codigo]: serie(codigo, ["10000", "0", "10002"]) }).buscar, instrumentoIds: [fondoId] });
    expect(r.valoresNuevos).toBe(2);
    expect(r.fallidos).toEqual([{ instrumentoId: fondoId, codigo: "SFC_VALOR_INVALIDO", guardados: 2, conError: 0, descartados: 1 }]);
  });

  it("ignora los fondos inactivos y las acciones", async () => {
    const inactivo = await crearFondo(nuevoCodigo(), false);
    const accion = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FND${corrida}`, codigoFic: nuevoCodigo(), nombre: "Acción ficticia" } })).id;
    const { buscar, urls } = sfcFalsa({});
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: [inactivo, accion] });
    expect(r).toMatchObject({ fondos: 0, valoresNuevos: 0, fallidos: [], ultimos: [] });
    expect(urls).toHaveLength(0);
  });

  it("marca atrasado el fondo sin datos o con su último dato anterior a hasta − 7 días", async () => {
    const sinDatos = await crearFondo();
    const viejo = await crearFondo();
    await db.valorUnidadFondo.create({ data: { fondoId: viejo, fechaValor: dia("2024-03-04"), valorUnidad: new Prisma.Decimal("10000"), fuente: FUENTE_SFC } });
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfcFalsa({}).buscar, instrumentoIds: [sinDatos, viejo] });
    expect(r.fallidos).toEqual([]);
    expect(new Map(r.ultimos.map((u) => [u.instrumentoId, [u.ultimaFecha, u.atrasado]]))).toEqual(
      new Map([[sinDatos, [null, true]], [viejo, [dia("2024-03-04"), true]]]),
    );
    const alDia = await actualizarFondo(db, { desde, hasta: dia("2024-03-11"), buscar: sfcFalsa({}).buscar, instrumentoIds: [viejo] });
    expect(alDia.ultimos[0]!.atrasado).toBe(false);
  });
});

describe("actualizarFondo · lotes y concurrencia", () => {
  it("una serie de más de un lote se guarda completa y repetirla no cambia nada", async () => {
    const fondoId = await crearFondo();
    const codigo = await codigoDe(fondoId);
    const inicio = dia("2022-01-01");
    const filas = Array.from({ length: 600 }, (_, i) => fila(codigo, new Date(inicio.getTime() + i * 86_400_000).toISOString().slice(0, 10), String(10000 + i)));
    const opciones = { desde: inicio, hasta: dia("2023-12-31"), buscar: sfcFalsa({ [codigo]: filas }).buscar, instrumentoIds: [fondoId] };
    expect(await actualizarFondo(db, opciones)).toMatchObject({ valoresNuevos: 600, valoresRevisados: 0, fallidos: [] });
    expect(await actualizarFondo(db, opciones)).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0, fallidos: [] });
    expect(await db.valorUnidadFondo.count({ where: { fondoId } })).toBe(600);
  });

  it("dos corridas a la vez dejan una sola fila vigente por día, sin errores", async () => {
    const fondoId = await crearFondo();
    const codigo = await codigoDe(fondoId);
    const opciones = (valores: string[]) => ({ desde, hasta, buscar: sfcFalsa({ [codigo]: serie(codigo, valores) }).buscar, instrumentoIds: [fondoId] });
    const nuevas = await Promise.all([actualizarFondo(db, opciones(["10000", "10001", "10002"])), actualizarFondo(db, opciones(["10000", "10001", "10002"]))]);
    expect(nuevas.flatMap((r) => r.fallidos)).toEqual([]);
    expect(nuevas[0]!.valoresNuevos + nuevas[1]!.valoresNuevos).toBe(3);
    const revisadas = await Promise.all([actualizarFondo(db, opciones(["20000", "20001", "20002"])), actualizarFondo(db, opciones(["20000", "20001", "20002"]))]);
    expect(revisadas.flatMap((r) => r.fallidos)).toEqual([]);
    expect(revisadas[0]!.valoresRevisados + revisadas[1]!.valoresRevisados).toBe(3);
    expect((await vigentes(fondoId)).map((x) => x.valorUnidad.toString())).toEqual(["20000", "20001", "20002"]);
    expect(await db.valorUnidadFondo.count({ where: { fondoId } })).toBe(6);
  });
});

describe("registrarFondo", () => {
  it("crea el fondo y su clase; repetirlo reutiliza los dos", async () => {
    const codigo = nuevoCodigo();
    const primero = await registrarFondo(db, { codigo, participacion: "901", nombre: "Fondo ficticio" }, HOY);
    expect(primero).toMatchObject({ fondoCreado: true, clase: "creada" });
    const segundo = await registrarFondo(db, { codigo, participacion: "901", nombre: "Fondo ficticio" }, HOY);
    expect(segundo).toEqual({ instrumentoId: primero.instrumentoId, fondoCreado: false, clase: "existente" });
    const fondo = await db.instrumento.findUniqueOrThrow({ where: { id: primero.instrumentoId } });
    expect([fondo.tipo, fondo.codigoFic, fondo.activo]).toEqual(["FIC", codigo, true]);
    const clases = await db.simboloPrecio.findMany({ where: { instrumentoId: primero.instrumentoId } });
    expect(clases.map((c) => [c.proveedor, c.simbolo, c.vigenteHasta])).toEqual([[FUENTE_SFC, "901", null]]);
  });

  it("sin clase, registra solo el fondo", async () => {
    const r = await registrarFondo(db, { codigo: nuevoCodigo(), participacion: null, nombre: "Fondo ficticio" }, HOY);
    expect(r).toMatchObject({ fondoCreado: true, clase: "no_indicada" });
    expect(await db.simboloPrecio.count({ where: { instrumentoId: r.instrumentoId } })).toBe(0);
  });

  it("no cambia en silencio una clase vigente distinta", async () => {
    const codigo = nuevoCodigo();
    const { instrumentoId } = await registrarFondo(db, { codigo, participacion: "901", nombre: "Fondo ficticio" }, HOY);
    await expect(registrarFondo(db, { codigo, participacion: "902", nombre: "Fondo ficticio" }, HOY)).rejects.toMatchObject({ codigo: "CLASE_DISTINTA" });
    expect((await db.simboloPrecio.findMany({ where: { instrumentoId } })).map((c) => c.simbolo)).toEqual(["901"]);
  });

  it("dos registros a la vez dejan un solo fondo y una sola clase", async () => {
    const codigo = nuevoCodigo();
    const datos = { codigo, participacion: "901", nombre: "Fondo ficticio" };
    const [a, b] = await Promise.all([registrarFondo(db, datos, HOY), registrarFondo(db, datos, HOY)]);
    expect(a.instrumentoId).toBe(b.instrumentoId);
    expect([a.fondoCreado, b.fondoCreado].sort()).toEqual([false, true]);
    expect(await db.instrumento.count({ where: { codigoFic: codigo } })).toBe(1);
    expect(await db.simboloPrecio.count({ where: { instrumentoId: a.instrumentoId } })).toBe(1);
  });

  it("una clase registrada que ya no está vigente da CLASE_NO_VIGENTE, no un error de la base", async () => {
    const codigo = nuevoCodigo();
    const fondoId = await crearFondo(codigo);
    await db.simboloPrecio.create({ data: { instrumentoId: fondoId, proveedor: FUENTE_SFC, simbolo: "901", vigenteDesde: dia("2016-01-01"), vigenteHasta: dia("2024-01-01") } });
    await expect(registrarFondo(db, { codigo, participacion: "902", nombre: "Fondo ficticio" }, HOY)).rejects.toMatchObject({ codigo: "CLASE_NO_VIGENTE" });
    expect(await db.simboloPrecio.count({ where: { instrumentoId: fondoId } })).toBe(1);
  });

  it("rechaza un código que ya usa una acción o un fondo inactivo", async () => {
    const deAccion = nuevoCodigo();
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FNR${corrida}`, codigoFic: deAccion, nombre: "Acción ficticia" } });
    await expect(registrarFondo(db, { codigo: deAccion, participacion: null, nombre: "F" }, HOY)).rejects.toBeInstanceOf(ErrorRegistroFondo);
    await expect(registrarFondo(db, { codigo: deAccion, participacion: null, nombre: "F" }, HOY)).rejects.toMatchObject({ codigo: "CODIGO_FIC_EN_USO" });
    const inactivo = nuevoCodigo();
    await crearFondo(inactivo, false);
    await expect(registrarFondo(db, { codigo: inactivo, participacion: null, nombre: "F" }, HOY)).rejects.toMatchObject({ codigo: "FONDO_INACTIVO" });
  });
});
