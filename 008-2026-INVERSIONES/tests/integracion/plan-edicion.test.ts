// Dominio del área de edición (fase B, PR-B) contra la base de PRUEBAS. Datos inventados.
//  1. Una versión nueva se crea contra la última que vio el formulario: si otra entró en medio, PLAN_CAMBIO y nada se escribe.
//  2. Una decisión con su orden de Trii se registra y se enlaza en UNA transacción: si el enlace no cabe, no queda nada.
//  3. La web corre como inv_app, que solo tiene INSERT en las cuatro tablas del plan (docker/migrador/privilegios.sql):
//     las funciones REALES del dominio deben funcionar así, sin UPDATE (el candado de la decisión no puede ser FOR
//     UPDATE). Sin crear roles (son globales del clúster y el del Mac tiene la base de trabajo): el rol predefinido
//     pg_read_all_data (lee todo, en todo PostgreSQL 16) recibe EXACTAMENTE los INSERT que privilegios.sql le da a
//     inv_app en esas tablas, y un cliente de una sola conexión hace SET ROLE. La prueba con inv_app real es
//     tests/unit/produccion/roles-base.test.ts (solo CI).
//  4. Los instantes («cuándo se registró») los pone la base: esos INSERT no los traen y nombrarlos da 42501.
// Las vigencias no retroceden y la base es compartida: se empieza después de la última versión (como plan.test.ts) y en
// fechas viejas (plan-pagina.test.ts necesita versiones lejos de hoy).
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient, type LadoOrden } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bloquearDecision } from "@/plan/bloqueos";
import { corregirDecision, registrarDecision, registrarDecisionConOrden } from "@/plan/decisiones";
import { enlazarOrden } from "@/plan/enlaces";
import { ErrorPlan } from "@/plan/errores";
import { sumarDias } from "@/plan/fechas";
import { crearVersionPlan } from "@/plan/versiones";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-6);
const ROL = "pg_read_all_data";
const TABLAS_DEL_PLAN = ["decision", "enlace_decision_orden", "plan_version", "regla_plan"];
/** Los instantes que pone la base (migración *_instantes_base): nunca en los INSERT de inv_app. */
const INSTANTES = ["creadaEn", "registradaEn", "creadoEn"];
/** El «hoy» de estas pruebas: lejos de las vigencias, para que las decisiones caigan en las versiones de aquí. */
const HOY = new Date("2026-06-30T00:00:00.000Z");
let base = new Date("2025-03-03T00:00:00.000Z");
const mas = (dias: number) => sumarDias(base, dias);
let duenoId = "";
let cargaId = "";
let instA = "";
let n = 0;

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "SIN_ERROR";
  } catch (e) {
    return e instanceof ErrorPlan ? e.codigo : `OTRO: ${String(e).slice(0, 160)}`;
  }
}

async function nuevaOrden(lado: LadoOrden, fecha: Date) {
  n += 1;
  const fila = await db.filaFuente.create({
    data: { tipoFuente: "TRII_ORDENES", claveNatural: `ed-${corrida}-${n}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
  });
  return db.orden.create({
    data: {
      filaFuenteId: fila.id, ejecutadaEn: new Date(fecha.getTime() + 15 * 3_600_000), fechaOperacion: fecha, fechaLiquidacion: sumarDias(fecha, 2),
      instrumentoId: instA, lado, estado: "APROBADO", cantidadCompletada: 37n, precioUnitario: new Prisma.Decimal("12.37"),
      totalInvertido: new Prisma.Decimal("457.69"), comision: new Prisma.Decimal("4.61"), totalEstimado: new Prisma.Decimal("453.08"),
    },
  });
}

const regla = (accion: "VENDER" | "COMPRAR" | "NO_ACTUAR", detalle: string) => ({
  instrumentoId: instA, condicion: "NINGUNA" as const, nivel: null, accion, cantidad: null, plazoHasta: null, detalle,
});

const contar = async () => ({
  versiones: await db.planVersion.count(),
  decisiones: await db.decision.count(),
  enlaces: await db.enlaceDecisionOrden.count(),
});

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-edicion-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (await db.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-edicion.ficticio.csv", sha256: "e".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } })).id;
  instA = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `EDA${corrida}`, nombre: "Acción ficticia de la edición" } })).id;
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
  if (mas(40) >= HOY) throw new Error("La base de pruebas tiene versiones del plan demasiado recientes: reiníciela.");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("versión nueva contra la última que vio el formulario", () => {
  it("si otra versión entró en medio, PLAN_CAMBIO y no se escribe nada; con la última de verdad, entra", async () => {
    const ultima = (await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
    const datos = { vigenteDesde: mas(0), motivo: "Versión ficticia de la edición", autorId: duenoId, reglas: [regla("NO_ACTUAR", "Mantener (ficticia)")] };
    const antes = await contar();
    expect(await codigo(crearVersionPlan(db, datos, { hoy: HOY, ultimaEsperada: ultima + 1 }))).toBe("PLAN_CAMBIO");
    expect(await codigo(crearVersionPlan(db, datos, { hoy: HOY, ultimaEsperada: Math.max(0, ultima - 1) }))).toBe(ultima === 0 ? "SIN_ERROR" : "PLAN_CAMBIO");
    if (ultima === 0) return;
    expect(await contar()).toEqual(antes);
    const v = await crearVersionPlan(db, datos, { hoy: HOY, ultimaEsperada: ultima });
    expect(v.version).toBe(ultima + 1);
    // Un segundo envío del mismo formulario (la misma última) ya no crea otra.
    expect(await codigo(crearVersionPlan(db, datos, { hoy: HOY, ultimaEsperada: ultima }))).toBe("PLAN_CAMBIO");
  });

  it("sin `ultimaEsperada` (el importador) se comporta como siempre", async () => {
    const v = await crearVersionPlan(db, { vigenteDesde: mas(1), motivo: "Otra versión ficticia", autorId: duenoId, reglas: [regla("VENDER", "Vender (ficticia)"), regla("COMPRAR", "Comprar (ficticia)")] }, { hoy: HOY });
    expect(v.reglaIds).toHaveLength(2);
  });
});

describe("decisión con su orden, en una sola transacción", () => {
  it("registra la decisión y la enlaza a la orden (la orden deja de estar «sin decisión»)", async () => {
    const venta = await nuevaOrden("VENTA", mas(3));
    const d = await registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Vender una parte (ficticio)", autorId: duenoId }, venta.id, { hoy: HOY });
    const enlaces = await db.enlaceDecisionOrden.findMany({ where: { ordenId: venta.id } });
    expect(enlaces.map((e) => [e.decisionId, e.reemplazaId, e.motivo, e.creadoPorId])).toEqual([[d.id, null, null, duenoId]]);
    expect(d.enlaceId).toBe(enlaces[0]!.id);
  });

  it.each([
    ["el lado no es el de la acción", "COMPRA" as const, 0, "LADO_DISTINTO"],
    ["la orden es anterior a la decisión", "VENTA" as const, -1, "ORDEN_ANTERIOR_A_LA_DECISION"],
  ])("si la orden no es coherente (%s), no queda ni la decisión", async (_caso, lado, dias, esperado) => {
    const orden = await nuevaOrden(lado, mas(2 + dias));
    const antes = await contar();
    expect(await codigo(registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Vender (ficticio)", autorId: duenoId }, orden.id, { hoy: HOY }))).toBe(esperado);
    expect(await contar()).toEqual(antes);
  });

  it("una orden que ya tiene decisión, o que no existe, tampoco deja nada", async () => {
    const venta = await nuevaOrden("VENTA", mas(3));
    await registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Primera (ficticio)", autorId: duenoId }, venta.id, { hoy: HOY });
    const antes = await contar();
    expect(await codigo(registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Segunda (ficticio)", autorId: duenoId }, venta.id, { hoy: HOY }))).toBe("ORDEN_YA_ENLAZADA");
    expect(await codigo(registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Sin orden (ficticio)", autorId: duenoId }, "orden-que-no-existe", { hoy: HOY }))).toBe("ORDEN_INEXISTENTE");
    expect(await contar()).toEqual(antes);
  });

  it("dos registros a la vez con la misma orden: uno entra, el otro sale ORDEN_YA_ENLAZADA y no deja su decisión", async () => {
    const venta = await nuevaOrden("VENTA", mas(3));
    const antes = await contar();
    const datos = { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER" as const, motivo: "A la vez (ficticio)", autorId: duenoId };
    const r = await Promise.all(Array.from({ length: 4 }, () => codigo(registrarDecisionConOrden(db, datos, venta.id, { hoy: HOY }))));
    expect(r.filter((c) => c === "SIN_ERROR")).toHaveLength(1);
    expect(r.filter((c) => c !== "SIN_ERROR").every((c) => c === "ORDEN_YA_ENLAZADA"), r.join(",")).toBe(true);
    const despues = await contar();
    expect([despues.decisiones - antes.decisiones, despues.enlaces - antes.enlaces]).toEqual([1, 1]);
  });

  it("«no actuar» no lleva orden: NO_ACTUAR_SIN_ORDEN y nada escrito", async () => {
    const compra = await nuevaOrden("COMPRA", mas(3));
    const antes = await contar();
    expect(await codigo(registrarDecisionConOrden(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "NO_ACTUAR", cantidad: 37n, motivo: "Esperar (ficticio)", autorId: duenoId }, compra.id, { hoy: HOY }))).toBe("NO_ACTUAR_SIN_ORDEN");
    expect(await contar()).toEqual(antes);
  });
});

/** Los INSERT (por columna) que privilegios.sql le da a inv_app en las tablas del plan, leídos del archivo. */
function insertsDelPlan(): { readonly tabla: string; readonly columnas: string }[] {
  const sql = readFileSync(new URL("../../docker/migrador/privilegios.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  return [...sql.matchAll(/GRANT INSERT (\([^)]*\)) ON TABLE public\.([a-z_]+) TO inv_app;/g)]
    .map((m) => ({ tabla: m[2]!, columnas: m[1]! }))
    .filter((g) => TABLAS_DEL_PLAN.includes(g.tabla))
    .sort((a, b) => a.tabla.localeCompare(b.tabla));
}

describe("con los privilegios de inv_app (solo INSERT en el plan): las funciones reales del dominio", () => {
  let restringida: PrismaClient;
  const quien = async () => (await restringida.$queryRaw<{ u: string }[]>`SELECT current_user::text AS u`)[0]?.u;

  beforeAll(async () => {
    const inserts = insertsDelPlan();
    expect(inserts.map((g) => g.tabla)).toEqual(TABLAS_DEL_PLAN);
    for (const g of inserts) await db.$executeRawUnsafe(`GRANT INSERT ${g.columnas} ON TABLE public.${g.tabla} TO ${ROL}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    restringida = new PrismaClient({ datasourceUrl: url.toString() });
    await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
  });

  afterAll(async () => {
    await restringida?.$disconnect();
    // REVOKE de tabla quita también los de columna.
    for (const t of TABLAS_DEL_PLAN) await db.$executeRawUnsafe(`REVOKE INSERT ON TABLE public.${t} FROM ${ROL}`);
  });

  it("el cliente es de verdad el rol restringido: sin UPDATE, DELETE ni FOR UPDATE en el plan (control positivo)", async () => {
    expect(await quien()).toBe(ROL);
    for (const sql of ["UPDATE decision SET motivo = motivo WHERE false", "DELETE FROM regla_plan WHERE false", "SELECT id FROM decision WHERE false FOR UPDATE", "INSERT INTO orden (id) VALUES ('x')"]) {
      await expect(restringida.$executeRawUnsafe(sql), sql).rejects.toThrow(/42501|permission denied/);
    }
  });

  it("crea una versión, registra, enlaza y corrige decisiones (también la decisión con su orden)", async () => {
    const ultima = (await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))!.version;
    const v = await crearVersionPlan(restringida, { vigenteDesde: mas(5), motivo: "Versión ficticia con inv_app", autorId: duenoId, reglas: [regla("VENDER", "Vender (ficticia)")] }, { hoy: HOY, ultimaEsperada: ultima });
    expect(await quien()).toBe(ROL);
    const datos = { fechaDecision: mas(6), instrumentoId: instA, accion: "VENDER" as const, reglaId: v.reglaIds[0]!, motivo: "Vender (ficticio, inv_app)", autorId: duenoId };
    const d = await registrarDecision(restringida, datos, { hoy: HOY });
    const venta = await nuevaOrden("VENTA", mas(7));
    await enlazarOrden(restringida, { ordenId: venta.id, decisionId: d.id, autorId: duenoId });
    const corregida = await corregirDecision(restringida, d.id, { ...datos, motivo: "Vender (ficticio, corregida con inv_app)" }, { hoy: HOY });
    expect(corregida.enlacesMovidos).toBe(1);
    const otraVenta = await nuevaOrden("VENTA", mas(7));
    const conOrden = await registrarDecisionConOrden(restringida, { ...datos, motivo: "Vender con su orden (ficticio, inv_app)" }, otraVenta.id, { hoy: HOY });
    expect(await quien()).toBe(ROL);
    const vigente = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { ordenId: venta.id, reemplazadoPor: { is: null } } });
    expect(vigente.decisionId).toBe(corregida.id);
    expect(await db.enlaceDecisionOrden.count({ where: { ordenId: otraVenta.id, decisionId: conOrden.id } })).toBe(1);
  });

  it("los instantes los pone la base: privilegios.sql no los da y nombrarlos da 42501 (la app no puede antedatar)", async () => {
    // El caso de arriba (crear, registrar, enlazar y corregir con estos privilegios) ya prueba que Prisma no los manda.
    const columnas = insertsDelPlan().map((g) => g.columnas).join(" ");
    for (const instante of INSTANTES) expect(columnas, instante).not.toContain(`"${instante}"`);
    for (const [tabla, columna] of [["plan_version", "creadaEn"], ["decision", "registradaEn"], ["enlace_decision_orden", "creadoEn"]] as const) {
      // Sin filas: el permiso de columna se revisa al empezar, antes del disparador y de las FK.
      const sql = `INSERT INTO ${tabla} (id, "${columna}") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`;
      await expect(restringida.$executeRawUnsafe(sql), sql).rejects.toThrow(/42501|permission denied/);
    }
    expect(await quien()).toBe(ROL);
  });

  it("la app crea la versión con estos privilegios sin nombrar el instante, y queda con la hora de la base", async () => {
    const ultima = (await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))!.version;
    const antes = (await db.$queryRaw<{ t: Date }[]>`SELECT clock_timestamp() AS t`)[0]!.t;
    const v = await crearVersionPlan(restringida, { vigenteDesde: mas(30), motivo: "Con la hora de la base (ficticia)", autorId: duenoId, reglas: [regla("VENDER", "Vender (ficticia)")] }, { hoy: HOY, ultimaEsperada: ultima });
    const fila = (await db.$queryRaw<{ ok: boolean }[]>`SELECT "creadaEn" >= ${antes}::timestamptz AND "creadaEn" <= clock_timestamp() AS ok FROM plan_version WHERE id = ${v.id}`)[0];
    expect(fila?.ok).toBe(true);
  });

  it("los disparadores de solo inserción siguen mandando aunque el rol tuviera UPDATE (defensa en profundidad)", async () => {
    await db.$executeRawUnsafe(`GRANT UPDATE, DELETE ON TABLE public.decision TO ${ROL}`);
    try {
      await expect(restringida.$executeRawUnsafe("UPDATE decision SET motivo = motivo")).rejects.toThrow(/solo inserción|solo insercion|P0001/i);
    } finally {
      await db.$executeRawUnsafe(`REVOKE UPDATE, DELETE ON TABLE public.decision FROM ${ROL}`);
    }
  });
});

describe("el candado de una decisión (consultivo, sin FOR UPDATE)", () => {
  it("dice si la decisión existe, y serializa: quien llega segundo espera al primero", async () => {
    const d = await registrarDecision(db, { fechaDecision: mas(2), instrumentoId: instA, accion: "VENDER", motivo: "Para el candado (ficticio)", autorId: duenoId }, { hoy: HOY });
    expect(await db.$transaction((tx) => bloquearDecision(tx, "decision-que-no-existe"))).toBe(false);
    const orden: string[] = [];
    let segundo: Promise<void> = Promise.resolve();
    await db.$transaction(
      async (tx) => {
        expect(await bloquearDecision(tx, d.id)).toBe(true);
        // El segundo no se espera aquí (esperaría al candado que esta transacción tiene): se espera después.
        segundo = db.$transaction(async (tx2) => {
          await bloquearDecision(tx2, d.id);
          orden.push("segundo");
        });
        await new Promise((r) => setTimeout(r, 300));
        orden.push("primero");
      },
      { timeout: 10_000 },
    );
    await segundo;
    expect(orden).toEqual(["primero", "segundo"]);
  });
});
