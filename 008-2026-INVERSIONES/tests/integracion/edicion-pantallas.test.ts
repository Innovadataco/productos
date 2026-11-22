// Lo que leen las tres páginas del área de edición (fase B, PR-B) contra la base de PRUEBAS. Datos inventados.
//  - /edicion/plan: precarga la vigente (o la versión pedida en ?base), con el nivel y la cantidad en es-CO como los lee
//    la ficha; la última versión (para no pisar otra) y la fecha mínima, que no retrocede; un ?base que no existe, la vigente.
//  - /edicion/decision: las versiones con sus reglas en texto; las órdenes aprobadas SIN decisión (las enlazadas no);
//    ?corrige precarga la decisión vigente (una corregida o que no existe, no); ?orden precarga la decisión de esa orden.
//  - /edicion/enlace: solo las órdenes que caben (aprobadas, sin decisión, de la especie y el lado, no anteriores).
// Fechas viejas y después de la última versión (plan-pagina.test.ts necesita versiones lejos de hoy).
import { Prisma, PrismaClient, type LadoOrden } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datosEdicionDecision } from "@/app/edicion/decision/datos";
import { datosEdicionEnlace } from "@/app/edicion/enlace/datos";
import { datosEdicionPlan } from "@/app/edicion/plan/datos";
import { corregirDecision, registrarDecision, registrarDecisionConOrden } from "@/plan/decisiones";
import { sumarDias } from "@/plan/fechas";
import { crearVersionPlan } from "@/plan/versiones";
import { fechaEnBogota } from "@/precios/horario";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-6);
const iso = (d: Date) => d.toISOString().slice(0, 10);
let base = new Date("2021-04-13T00:00:00.000Z");
const mas = (dias: number) => sumarDias(base, dias);
let duenoId = "";
let cargaId = "";
let instA = "";
let instB = "";
let n = 0;
const ids = { v1: 0, v2: 0, reglaA: "", reglaP: "", decision: "", corregida: "", noActuar: "", ventaLibre: "", ventaEnlazada: "", compraLibre: "", ventaVieja: "" };

async function orden(instrumentoId: string, lado: LadoOrden, fecha: Date, cantidad = 37n) {
  n += 1;
  const fila = await db.filaFuente.create({
    data: { tipoFuente: "TRII_ORDENES", claveNatural: `pan-${corrida}-${n}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
  });
  return (await db.orden.create({
    data: {
      filaFuenteId: fila.id, ejecutadaEn: new Date(fecha.getTime() + 15 * 3_600_000), fechaOperacion: fecha, fechaLiquidacion: sumarDias(fecha, 2), instrumentoId, lado,
      estado: "APROBADO", cantidadCompletada: cantidad, precioUnitario: new Prisma.Decimal("11.37"), totalInvertido: new Prisma.Decimal("420.69"),
      comision: new Prisma.Decimal("3.71"), totalEstimado: new Prisma.Decimal("416.98"),
    },
  })).id;
}

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-pantallas-edicion-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (await db.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-pantallas.ficticio.csv", sha256: "9".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } })).id;
  instA = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PEA${corrida}`, nombre: "Acción ficticia A" } })).id;
  instB = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PEB${corrida}`, nombre: "Acción ficticia B" } })).id;
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
  const hoy = fechaEnBogota(new Date());
  const v1 = await crearVersionPlan(db, {
    vigenteDesde: mas(0), motivo: "Versión ficticia 1", autorId: duenoId,
    reglas: [
      { instrumentoId: instA, condicion: "CIERRE_SOBRE", nivel: "37911.47", accion: "VENDER", cantidad: 4613n, plazoHasta: null, detalle: "Vender sobre el nivel (ficticia)" },
      { instrumentoId: null, condicion: "LIBRE", nivel: null, accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle: "Siempre orden límite (ficticia)" },
    ],
  }, { hoy });
  ids.v1 = v1.version;
  [ids.reglaA, ids.reglaP] = v1.reglaIds as [string, string];
  const v2 = await crearVersionPlan(db, { vigenteDesde: mas(10), motivo: "Versión ficticia 2", autorId: duenoId, reglas: [{ instrumentoId: instB, condicion: "NINGUNA", nivel: null, accion: "COMPRAR", cantidad: null, plazoHasta: null, detalle: "Comprar B (ficticia)" }] }, { hoy });
  ids.v2 = v2.version;
  ids.ventaEnlazada = await orden(instA, "VENTA", mas(2));
  ids.decision = (await registrarDecisionConOrden(db, { fechaDecision: mas(1), instrumentoId: instA, accion: "VENDER", reglaId: ids.reglaA, motivo: "Vender (ficticio)", autorId: duenoId }, ids.ventaEnlazada, { hoy })).id;
  ids.corregida = (await corregirDecision(db, ids.decision, { fechaDecision: mas(1), instrumentoId: instA, accion: "VENDER", cantidad: 37n, reglaId: ids.reglaA, motivo: "Vender (ficticio, corregida)", autorId: duenoId }, { hoy })).id;
  ids.noActuar = (await registrarDecision(db, { fechaDecision: mas(3), instrumentoId: instA, accion: "NO_ACTUAR", cantidad: 41n, motivo: "Esperar (ficticio)", autorId: duenoId }, { hoy })).id;
  ids.ventaLibre = await orden(instA, "VENTA", mas(4), 13n);
  ids.compraLibre = await orden(instA, "COMPRA", mas(4));
  ids.ventaVieja = await orden(instA, "VENTA", mas(0));
});

afterAll(async () => {
  await db.$disconnect();
});

describe("datos de /edicion/plan", () => {
  it("sin ?base: la última que ya rige (la v2 de aquí), su vigencia mínima y la última versión", async () => {
    const d = await datosEdicionPlan(db, undefined);
    expect(d.ultima).toMatchObject({ numero: ids.v2, desde: iso(mas(10)) });
    expect(d.base).toMatchObject({ numero: ids.v2, tipo: "VIGENTE" });
    expect(d.reglas).toEqual([{ instrumentoId: instB, condicion: "NINGUNA", nivel: "", accion: "COMPRAR", cantidad: "", plazoHasta: "", detalle: "Comprar B (ficticia)" }]);
    expect(d.vigenteDesde >= iso(mas(10))).toBe(true);
    expect(d.especies).toEqual(expect.arrayContaining([{ id: instA, nemotecnico: `PEA${corrida}` }, { id: instB, nemotecnico: `PEB${corrida}` }]));
  });

  it("con ?base=<v1>: sus reglas con el nivel y la cantidad en es-CO; un ?base que no existe, la vigente", async () => {
    const d = await datosEdicionPlan(db, String(ids.v1));
    expect(d.base).toMatchObject({ numero: ids.v1, tipo: "HISTORICA" });
    expect(d.reglas.find((r) => r.instrumentoId === instA)).toEqual({ instrumentoId: instA, condicion: "CIERRE_SOBRE", nivel: "37.911,47", accion: "VENDER", cantidad: "4.613", plazoHasta: "", detalle: "Vender sobre el nivel (ficticia)" });
    for (const malo of ["0", "999999", "abc", ["1", "2"]]) expect((await datosEdicionPlan(db, malo)).base?.numero, String(malo)).toBe(ids.v2);
  });
});

describe("datos de /edicion/decision", () => {
  it("las versiones con sus reglas en texto; las órdenes aprobadas sin decisión (la enlazada no)", async () => {
    const d = await datosEdicionDecision(db, {});
    if (d.estado !== "LISTO") throw new Error(d.estado);
    const v1 = d.versiones.find((v) => v.numero === ids.v1)!;
    expect(v1.desde).toBe(iso(mas(0)));
    expect(v1.reglas.find((r) => r.id === ids.reglaA)).toEqual({ id: ids.reglaA, instrumentoId: instA, accion: "VENDER", texto: `PEA${corrida} · Cierre por encima de $ 37.911,47 → vender` });
    expect(v1.reglas.find((r) => r.id === ids.reglaP)?.texto).toBe("Portafolio · Regla escrita → no actuar");
    const mias = d.ordenes.filter((o) => o.instrumentoId === instA).map((o) => o.id);
    expect(mias).toEqual(expect.arrayContaining([ids.ventaLibre, ids.compraLibre, ids.ventaVieja]));
    expect(mias).not.toContain(ids.ventaEnlazada);
    expect(d.ordenes.find((o) => o.id === ids.ventaLibre)).toMatchObject({ lado: "VENTA", fecha: iso(mas(4)) });
    expect(d.corrige).toBeNull();
    expect(d.inicial).toMatchObject({ motivo: "", ordenId: "", excepcion: false });
  });

  it("?corrige=<vigente> precarga la decisión; una corregida o que no existe no se puede corregir", async () => {
    const d = await datosEdicionDecision(db, { corrige: ids.corregida });
    if (d.estado !== "LISTO") throw new Error(d.estado);
    expect(d.corrige).toEqual({ id: ids.corregida, fecha: iso(mas(1)), especie: `PEA${corrida}` });
    expect(d.inicial).toEqual({ fechaDecision: iso(mas(1)), instrumentoId: instA, accion: "VENDER", cantidad: "37", reglaId: ids.reglaA, excepcion: false, motivo: "Vender (ficticio, corregida)", ordenId: "" });
    for (const corrige of [ids.decision, "no-existe", "MAL FORMADO", ["a", "b"]]) expect((await datosEdicionDecision(db, { corrige })).estado, String(corrige)).toBe("CORRECCION_INVALIDA");
  });

  it("?orden=<sin decisión> precarga la especie, la acción del lado, la cantidad, la fecha y la orden", async () => {
    const d = await datosEdicionDecision(db, { orden: ids.ventaLibre });
    if (d.estado !== "LISTO") throw new Error(d.estado);
    expect(d.inicial).toMatchObject({ fechaDecision: iso(mas(4)), instrumentoId: instA, accion: "VENDER", cantidad: "13", ordenId: ids.ventaLibre });
    const enlazada = await datosEdicionDecision(db, { orden: ids.ventaEnlazada });
    if (enlazada.estado !== "LISTO") throw new Error(enlazada.estado);
    expect(enlazada.inicial.ordenId).toBe("");
  });
});

describe("datos de /edicion/enlace", () => {
  it("solo las órdenes que caben en la decisión vigente (especie, lado, sin decisión, no anteriores)", async () => {
    const d = await datosEdicionEnlace(db, ids.corregida);
    if (d.estado !== "LISTO") throw new Error(d.estado);
    expect(d.decision.id).toBe(ids.corregida);
    expect(d.decision.texto).toContain(`PEA${corrida}`);
    expect(d.ordenes.map((o) => o.id)).toEqual([ids.ventaLibre]);
  });

  it("una corregida, «no actuar» o una que no existe dan su estado", async () => {
    expect(await datosEdicionEnlace(db, ids.decision)).toEqual({ estado: "REEMPLAZADA", corregidaPor: ids.corregida });
    expect(await datosEdicionEnlace(db, ids.noActuar)).toEqual({ estado: "NO_ACTUAR", id: ids.noActuar });
    for (const malo of [undefined, "no-existe", "MAL FORMADO"]) expect(await datosEdicionEnlace(db, malo)).toEqual({ estado: "NO_EXISTE" });
  });
});
