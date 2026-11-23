// La tabla tarifa_comision (fase E, O5) contra la base de PRUEBAS: cada CHECK muerde (con su control positivo: la fila
// válida entra), la versión es única, nada se edita ni se borra, el autor existe y la hora la pone la base. Los
// privilegios de inv_app (INSERT por columna sin "creadaEn") se prueban sin crear roles (son globales del clúster): un
// rol predefinido recibe EXACTAMENTE el GRANT de privilegios.sql sobre tarifa_comision, leído del archivo, y un cliente
// de una sola conexión hace SET ROLE. También los lectores y el creador de la app, el control y las entradas del
// simulador. Datos inventados (porcentajes raros, fechas anteriores a 2022).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datosEdicionTarifas } from "@/app/edicion/tarifas/datos";
import { leerEntradasSimulador } from "@/operar/pantalla/leer";
import { crearVersionTarifa } from "@/operar/tarifa/crear";
import { ErrorTarifa } from "@/operar/tarifa/errores";
import { leerOrdenesHistoricas, leerTarifas } from "@/operar/tarifa/leer";
import type { EntradaTarifa } from "@/operar/tarifa/pedido";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
const sql = readFileSync(fileURLToPath(new URL("../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");
const grantsDe = (rol: string) =>
  [...sql.matchAll(new RegExp(`GRANT\\s+([A-Z]+\\s*(?:\\([^)]*\\))?)\\s+ON\\s+TABLE\\s+public\\.tarifa_comision\\s+TO\\s+${rol}\\s*;`, "g"))].map((m) => m[1]!);
let autorId = "";

const ultima = async (): Promise<number> => (await db.tarifaComision.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
const D = (v: string) => new Prisma.Decimal(v);
type Datos = Omit<Prisma.TarifaComisionUncheckedCreateInput, "version" | "autorId">;
const BASE: Datos = {
  comisionista: "TRII", lado: "COMPRA", porcentaje: D("0.2731"), minimoPorOrden: D("7.13"), fijoPorOrden: D("1.37"), ivaPct: D("17.31"),
  otrosCargos: [{ nombre: "Cargo ficticio", tipo: "PCT", valor: "0.0137" }], vigenteDesde: new Date(Date.UTC(2021, 2, 17)), motivo: "Tarifa ficticia de la prueba",
};
const crear = async (cambios: Partial<Datos> = {}) => db.tarifaComision.create({ data: { ...BASE, ...cambios, version: (await ultima()) + 1, autorId } });
const cargo = (c: Record<string, unknown>) => ({ otrosCargos: [{ nombre: "C", tipo: "FIJO", valor: "1", ...c }] });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  autorId = (await db.usuario.create({ data: { email: `dueno-tarifa-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("tarifa_comision · control positivo y bordes", () => {
  it("entran una tarifa completa, una sin cargos y los bordes (0 y 100 %, montos bajo el tope, 3 cargos, nombre de 60)", async () => {
    await expect(crear()).resolves.toMatchObject({ comisionista: "TRII" });
    await expect(crear({ comisionista: "AV", lado: "VENTA", otrosCargos: [] })).resolves.toBeDefined();
    await expect(crear({ porcentaje: D("0"), ivaPct: D("100") })).resolves.toBeDefined();
    await expect(crear({ porcentaje: D("100"), minimoPorOrden: D("99999999.9999"), fijoPorOrden: D("0") })).resolves.toBeDefined();
    const tres = [{ nombre: "x".repeat(60), tipo: "PCT", valor: "100" }, { nombre: "B", tipo: "PCT", valor: "100.0000" }, { nombre: "C", tipo: "FIJO", valor: "99999999.9999" }];
    await expect(crear({ otrosCargos: tres })).resolves.toBeDefined();
  });
});

describe("tarifa_comision · cada CHECK muerde", () => {
  it.each([
    ["un comisionista fuera de la lista", { comisionista: "OTRA" }, "tarifa_comision_comisionista_chk"],
    ["un porcentaje sobre 100", { porcentaje: D("100.0001") }, "tarifa_comision_porcentaje_chk"],
    ["un porcentaje negativo", { porcentaje: D("-0.0001") }, "tarifa_comision_porcentaje_chk"],
    ["un IVA sobre 100", { ivaPct: D("100.01") }, "tarifa_comision_iva_chk"],
    ["un mínimo en el tope", { minimoPorOrden: D("100000000") }, "tarifa_comision_montos_chk"],
    ["un fijo negativo", { fijoPorOrden: D("-1") }, "tarifa_comision_montos_chk"],
    ["un motivo de solo espacios", { motivo: "   " }, "tarifa_comision_motivo_chk"],
    ["un motivo de más de 2000", { motivo: "m".repeat(2001) }, "tarifa_comision_motivo_chk"],
    ["otros cargos que no son una lista", { otrosCargos: { nombre: "C" } }, "tarifa_comision_cargos_chk"],
    ["cuatro cargos", { otrosCargos: Array.from({ length: 4 }, () => ({ nombre: "C", tipo: "FIJO", valor: "1" })) }, "tarifa_comision_cargos_chk"],
    ["un cargo con una clave de más", cargo({ otra: 1 }), "tarifa_comision_cargos_chk"],
    ["un cargo sin valor", { otrosCargos: [{ nombre: "C", tipo: "FIJO" }] }, "tarifa_comision_cargos_chk"],
    ["un cargo de tipo desconocido", cargo({ tipo: "OTRO" }), "tarifa_comision_cargos_chk"],
    ["un cargo con nombre vacío", cargo({ nombre: "" }), "tarifa_comision_cargos_chk"],
    ["un cargo con nombre de solo espacios", cargo({ nombre: "  " }), "tarifa_comision_cargos_chk"],
    ["un cargo con nombre de 61", cargo({ nombre: "x".repeat(61) }), "tarifa_comision_cargos_chk"],
    ["un cargo con un control en el nombre", cargo({ nombre: "a\nb" }), "tarifa_comision_cargos_chk"],
    ["un cargo con valor numérico (no texto)", cargo({ valor: 1 }), "tarifa_comision_cargos_chk"],
    ["un cargo con valor negativo", cargo({ valor: "-1" }), "tarifa_comision_cargos_chk"],
    ["un cargo con 5 decimales", cargo({ valor: "1.23456" }), "tarifa_comision_cargos_chk"],
    ["un cargo fijo de 9 enteros", cargo({ valor: "100000000" }), "tarifa_comision_cargos_chk"],
    ["un cargo PCT sobre 100", cargo({ tipo: "PCT", valor: "100.0001" }), "tarifa_comision_cargos_chk"],
    ["el tercer cargo mal (el desenrollado llega hasta él)", { otrosCargos: [{ nombre: "A", tipo: "FIJO", valor: "1" }, { nombre: "B", tipo: "FIJO", valor: "1" }, { nombre: "C", tipo: "PCT", valor: "101" }] }, "tarifa_comision_cargos_chk"],
  ] as const)("rechaza %s (%s)", async (_n, cambios, restriccion) => {
    await expect(crear(cambios as unknown as Partial<Datos>)).rejects.toThrow(new RegExp(restriccion));
  });

  it("la versión es única y mayor que cero; el autor existe", async () => {
    const v = (await ultima()) + 1;
    await db.tarifaComision.create({ data: { ...BASE, version: v, autorId } });
    await expect(db.tarifaComision.create({ data: { ...BASE, version: v, autorId } })).rejects.toThrow(/Unique constraint|P2002/);
    await expect(db.tarifaComision.create({ data: { ...BASE, version: 0, autorId } })).rejects.toThrow(/tarifa_comision_version_chk/);
    await expect(db.tarifaComision.create({ data: { ...BASE, version: v + 1, autorId: `no-existe-${corrida}` } })).rejects.toThrow(/Foreign key|P2003/);
  });

  it("una versión no se edita ni se borra", async () => {
    const t = await crear();
    await expect(db.tarifaComision.update({ where: { id: t.id }, data: { motivo: "otro" } })).rejects.toThrow(/solo inserción/);
    await expect(db.tarifaComision.delete({ where: { id: t.id } })).rejects.toThrow(/solo inserción/);
  });
});

describe("tarifa_comision · privilegios de inv_app (pg_read_all_data con los GRANT de privilegios.sql)", () => {
  const ROL = "pg_read_all_data";
  let restringida: PrismaClient;

  beforeAll(async () => {
    const grants = grantsDe("inv_app");
    expect(grants).toHaveLength(1);
    for (const g of grants) await db.$executeRawUnsafe(`GRANT ${g} ON TABLE public.tarifa_comision TO ${ROL}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    restringida = new PrismaClient({ datasourceUrl: url.toString() });
    await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
  });

  afterAll(async () => {
    await restringida.$disconnect();
    await db.$executeRawUnsafe(`REVOKE INSERT ON TABLE public.tarifa_comision FROM ${ROL}`);
  });

  it("crearVersionTarifa inserta como inv_app (sin mandar la hora) y la base la fecha con su reloj", async () => {
    const antes = new Date();
    const entrada: EntradaTarifa = {
      comisionista: "TRII", lado: "VENTA", porcentaje: "0.3719", minimoPorOrden: "4613.27", fijoPorOrden: "0", ivaPct: "17.31",
      otrosCargos: [{ nombre: "Otro ficticio", tipo: "FIJO", valor: "2.11" }], vigenteDesde: new Date(Date.UTC(2021, 2, 17)), motivo: "Versión ficticia",
    };
    const base = await ultima();
    const creada = await crearVersionTarifa(restringida, entrada, { autorId, ultimaEsperada: base });
    expect(creada.version).toBe(base + 1);
    const fila = await db.tarifaComision.findUniqueOrThrow({ where: { version: creada.version } });
    expect(fila.creadaEn.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 5_000);
    expect(fila.minimoPorOrden.toFixed()).toBe("4613.27");
    expect(fila.otrosCargos).toEqual([{ nombre: "Otro ficticio", tipo: "FIJO", valor: "2.11" }]);
    // Contra una versión vieja (otra entró en medio), TARIFA_CAMBIO sin escribir.
    await expect(crearVersionTarifa(restringida, entrada, { autorId, ultimaEsperada: base })).rejects.toEqual(new ErrorTarifa("TARIFA_CAMBIO"));
    await expect(crearVersionTarifa(restringida, entrada, { autorId: `no-existe-${corrida}`, ultimaEsperada: base + 1 })).rejects.toEqual(new ErrorTarifa("AUTOR_INEXISTENTE"));
    expect(await ultima()).toBe(base + 1);
  });

  it("no puede nombrar la hora (42501, también sin filas) ni editar ni borrar", async () => {
    for (const sentencia of [
      `INSERT INTO tarifa_comision (id, "creadaEn") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`,
      "UPDATE tarifa_comision SET motivo = motivo WHERE false",
      "DELETE FROM tarifa_comision WHERE false",
    ]) await expect(restringida.$executeRawUnsafe(sentencia), sentencia).rejects.toThrow(/42501|permission denied/);
  });
});

describe("lectores de la app", () => {
  it("leerTarifas: de la más nueva a la más vieja, con los cargos como Decimal; las órdenes de la historia", async () => {
    await crear({ otrosCargos: [{ nombre: "Leída", tipo: "PCT", valor: "0.0137" }], motivo: `leida-${corrida}` });
    const tarifas = await leerTarifas(db, 50);
    expect(tarifas.map((t) => t.version)).toEqual([...tarifas.map((t) => t.version)].sort((a, b) => b - a));
    const mia = tarifas[0]!;
    expect(mia.motivo).toBe(`leida-${corrida}`);
    expect(mia.otrosCargos[0]?.valor.toFixed()).toBe("0.0137");
    expect(Array.isArray(await leerOrdenesHistoricas(db))).toBe(true);
  });

  it("leerEntradasSimulador trae la tarifa vigente del comisionista y la historia; /edicion/tarifas, la vigente con su control", async () => {
    const t = await crear({ comisionista: "AV", lado: "COMPRA", motivo: `vigente-${corrida}` });
    const e = await leerEntradasSimulador(db, new Date(Date.UTC(2021, 2, 18)), "AV");
    expect(e.contexto.tarifas?.COMPRA?.version).toBe(t.version);
    expect(e.estado.caja).toBeInstanceOf(Prisma.Decimal);
    const d = await datosEdicionTarifas(db, String(t.version));
    expect(d.guardada).toBe(t.version);
    expect(d.ultimaVersion).toBe(t.version);
    const av = d.vigentes.find((v) => v.comisionista === "Acciones & Valores" && v.lado === "Compra");
    expect(av?.tarifa?.version).toBe(t.version);
    expect(av?.control).toBe("Sin órdenes para contrastar: 008 solo tiene las órdenes de Trii.");
    expect((await datosEdicionTarifas(db, "no-es-version")).guardada).toBeNull();
  });
});
