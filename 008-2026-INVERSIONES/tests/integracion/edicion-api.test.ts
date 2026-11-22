// Las tres rutas de escritura del área de edición (fase B, PR-B) contra la base de PRUEBAS, con la sesión revalidada de
// verdad (cookie firmada, cuenta con clave y TOTP activo):
//  - la familia recibe 403 «Solo lectura» en cada una y la base no cambia;
//  - el dueño crea una versión (nivel y cantidad como los escribe en el formulario, leídos como la ficha), registra una
//    decisión con su orden, la corrige y enlaza otra orden a una decisión; con la versión base vieja, 409 PLAN_CAMBIO;
//  - un dato mal escrito da 400 con su campo y su código, nunca el valor.
// next/headers y next/navigation se simulan (fuera de Next no existen). Datos inventados; fechas viejas (plan-pagina).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";
import { firmarToken } from "@/auth/token";
import { sumarDias } from "@/plan/fechas";
import { activarTotp } from "./auth-totp-ayudas";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT ${destino}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { POST as postDecision } from "@/app/api/decisiones/route";
import { POST as postEnlace } from "@/app/api/decisiones/enlaces/route";
import { POST as postVersion } from "@/app/api/plan/versiones/route";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toLowerCase().slice(-6);
const SECRETO = "m".repeat(32);
const CLAVE = new TextEncoder().encode(SECRETO);
const HASH = `$2b$12$${"h".repeat(53)}`;
const ORIGEN = ORIGENES_DESARROLLO[0]!;
const iso = (d: Date) => d.toISOString().slice(0, 10);
let base = new Date("2021-02-17T00:00:00.000Z");
const mas = (dias: number) => sumarDias(base, dias);
let tokenDueno = "";
let tokenFamilia = "";
let instA = "";
let cargaId = "";
let duenoId = "";
let n = 0;

async function cuenta(rol: "DUENO" | "FAMILIA") {
  const u = await db.usuario.create({ data: { email: `edicion-api-${corrida}-${rol.toLowerCase()}@ejemplo.invalid`, rol, claveHash: HASH } });
  await activarTotp(db, u.id, new Date());
  return u;
}

const pedido = (ruta: string, cuerpo: unknown, token: string) =>
  new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGEN, cookie: `__Host-sesion=${token}` },
    body: JSON.stringify(cuerpo),
  });

async function nuevaVenta(fecha: Date) {
  n += 1;
  const fila = await db.filaFuente.create({
    data: { tipoFuente: "TRII_ORDENES", claveNatural: `api-${corrida}-${n}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
  });
  return db.orden.create({
    data: {
      filaFuenteId: fila.id, ejecutadaEn: new Date(fecha.getTime() + 15 * 3_600_000), fechaOperacion: fecha, fechaLiquidacion: sumarDias(fecha, 2), instrumentoId: instA,
      lado: "VENTA", estado: "APROBADO", cantidadCompletada: 41n, precioUnitario: new Prisma.Decimal("13.71"), totalInvertido: new Prisma.Decimal("562.11"),
      comision: new Prisma.Decimal("4.13"), totalEstimado: new Prisma.Decimal("557.98"),
    },
  });
}

const ultimaVersion = async () => (await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
const huella = async () => [await db.planVersion.count(), await db.reglaPlan.count(), await db.decision.count(), await db.enlaceDecisionOrden.count()];

const reglaForm = (cambios: Record<string, unknown> = {}) => ({
  instrumentoId: instA, condicion: "CIERRE_SOBRE", nivel: "1.237,5", accion: "VENDER", cantidad: "4.613", plazoHasta: "", detalle: "Vender si cierra sobre el nivel (ficticia)", ...cambios,
});

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  process.env.AUTH_SECRET = SECRETO;
  vi.stubEnv("NODE_ENV", "development");
  const dueno = await cuenta("DUENO");
  duenoId = dueno.id;
  tokenDueno = await firmarToken({ sub: dueno.id, sesionVersion: 1 }, CLAVE, Date.now());
  tokenFamilia = await firmarToken({ sub: (await cuenta("FAMILIA")).id, sesionVersion: 1 }, CLAVE, Date.now());
  cargaId = (await db.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes-edicion-api.ficticio.csv", sha256: "f".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } })).id;
  instA = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `API${corrida.toUpperCase()}`, nombre: "Acción ficticia de la API" } })).id;
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("la familia no escribe (403 «Solo lectura» y la base no cambia)", () => {
  it("en las tres rutas, aun con un cuerpo válido y el Origin de la app", async () => {
    const antes = await huella();
    const casos = [
      () => postVersion(pedido("/api/plan/versiones", { vigenteDesde: iso(mas(0)), motivo: "Intento ficticio", versionBase: 0, reglas: [reglaForm()] }, tokenFamilia)),
      () => postDecision(pedido("/api/decisiones", { fechaDecision: iso(mas(0)), instrumentoId: instA, accion: "NO_ACTUAR", cantidad: "37", reglaId: null, excepcion: false, motivo: "Intento ficticio", ordenId: null, corrige: null }, tokenFamilia)),
      () => postEnlace(pedido("/api/decisiones/enlaces", { decisionId: "decision-ficticia", ordenId: "orden-ficticia" }, tokenFamilia)),
    ];
    for (const caso of casos) {
      const r = await caso();
      expect(r.status).toBe(403);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ error: MENSAJE_SOLO_LECTURA });
    }
    expect(await huella()).toEqual(antes);
  });

  it("sin sesión, 401; sin el Origin de la app, 403 antes de mirar la sesión", async () => {
    const sinSesion = await postEnlace(new Request(`${ORIGEN}/api/decisiones/enlaces`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN }, body: "{}" }));
    expect(sinSesion.status).toBe(401);
    const otroOrigen = await postEnlace(new Request(`${ORIGEN}/api/decisiones/enlaces`, { method: "POST", headers: { "content-type": "application/json", origin: "https://otro.ejemplo.invalid", cookie: `__Host-sesion=${tokenDueno}` }, body: "{}" }));
    expect(otroOrigen.status).toBe(403);
  });
});

describe("el dueño edita el plan y el diario", () => {
  const ids = { regla: "", decision: "", corregida: "" };

  it("crea una versión: nivel y cantidad como los escribe (es-CO), guardados exactos; con la base vieja, 409", async () => {
    const versionBase = await ultimaVersion();
    const cuerpo = { vigenteDesde: iso(mas(0)), motivo: "  Versión ficticia desde la web  ", versionBase, reglas: [reglaForm(), reglaForm({ instrumentoId: null, condicion: "LIBRE", nivel: "", accion: "NO_ACTUAR", cantidad: "", detalle: "Siempre orden límite (ficticia)" })] };
    const r = await postVersion(pedido("/api/plan/versiones", cuerpo, tokenDueno));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ version: versionBase + 1 });
    const v = await db.planVersion.findUniqueOrThrow({ where: { version: versionBase + 1 }, include: { reglas: { orderBy: { detalle: "desc" } } } });
    expect([v.motivo, v.aprobadaPorId, iso(v.vigenteDesde)]).toEqual(["Versión ficticia desde la web", duenoId, iso(mas(0))]);
    expect(v.reglas.map((x) => [x.instrumentoId, x.condicion, x.nivel?.toString() ?? null, x.cantidad])).toEqual([
      [instA, "CIERRE_SOBRE", "1237.5", 4613n],
      [null, "LIBRE", null, null],
    ]);
    ids.regla = v.reglas[0]!.id;
    const vieja = await postVersion(pedido("/api/plan/versiones", { ...cuerpo, vigenteDesde: iso(mas(1)) }, tokenDueno));
    expect(vieja.status).toBe(409);
    expect(await vieja.json()).toMatchObject({ codigo: "PLAN_CAMBIO" });
  });

  it("un dato mal escrito: 400 con el campo y el código, sin el valor; la base no cambia", async () => {
    const antes = await huella();
    const r = await postVersion(pedido("/api/plan/versiones", { vigenteDesde: iso(mas(1)), motivo: "Ficticia", versionBase: await ultimaVersion(), reglas: [reglaForm({ nivel: "1.5" }), reglaForm({ condicion: "LIBRE" })] }, tokenDueno));
    expect(r.status).toBe(400);
    const cuerpo = await r.json();
    expect(cuerpo.campos).toEqual([
      { campo: "reglas[0].nivel", codigo: "NIVEL_NO_RECONOCIDO" },
    ]);
    expect(JSON.stringify(cuerpo)).not.toContain("1.5");
    // La semántica la dice el dominio (las mismas validaciones del importador): LIBRE no lleva nivel.
    const r2 = await postVersion(pedido("/api/plan/versiones", { vigenteDesde: iso(mas(1)), motivo: "Ficticia", versionBase: await ultimaVersion(), reglas: [reglaForm({ condicion: "LIBRE" })] }, tokenDueno));
    expect(r2.status).toBe(400);
    expect((await r2.json()).campos).toEqual([{ campo: "reglas[0].nivel", codigo: "NIVEL_SOBRA" }]);
    expect(await huella()).toEqual(antes);
  });

  it("registra una decisión con su orden (en una sola transacción), la corrige y la orden pasa a la corrección", async () => {
    const venta = await nuevaVenta(mas(2));
    const datos = { fechaDecision: iso(mas(1)), instrumentoId: instA, accion: "VENDER", cantidad: "41", reglaId: ids.regla, excepcion: false, motivo: "Vender por la regla (ficticio)", ordenId: venta.id, corrige: null };
    const r = await postDecision(pedido("/api/decisiones", datos, tokenDueno));
    expect(r.status).toBe(201);
    ids.decision = (await r.json()).id;
    expect(await db.enlaceDecisionOrden.count({ where: { ordenId: venta.id, decisionId: ids.decision } })).toBe(1);
    const c = await postDecision(pedido("/api/decisiones", { ...datos, ordenId: null, corrige: ids.decision, motivo: "Vender por la regla (ficticio, corregida)" }, tokenDueno));
    expect(c.status).toBe(201);
    ids.corregida = (await c.json()).id;
    const vigente = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { ordenId: venta.id, reemplazadoPor: { is: null } } });
    expect(vigente.decisionId).toBe(ids.corregida);
    const otraVez = await postDecision(pedido("/api/decisiones", { ...datos, ordenId: null, corrige: ids.decision }, tokenDueno));
    expect(otraVez.status).toBe(409);
    expect(await otraVez.json()).toMatchObject({ codigo: "DECISION_YA_REEMPLAZADA" });
  });

  it("una decisión que se aparta de su regla sin marcar la excepción: 400 con el campo", async () => {
    const r = await postDecision(pedido("/api/decisiones", { fechaDecision: iso(mas(1)), instrumentoId: instA, accion: "COMPRAR", cantidad: "", reglaId: ids.regla, excepcion: false, motivo: "Comprar (ficticio)", ordenId: null, corrige: null }, tokenDueno));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ codigo: "ACCION_DISTINTA_SIN_EXCEPCION", campos: [{ campo: "accion", codigo: "ACCION_DISTINTA_SIN_EXCEPCION" }] });
  });

  it("enlaza después una orden importada a la decisión vigente; a la reemplazada, no", async () => {
    const venta = await nuevaVenta(mas(3));
    const aVieja = await postEnlace(pedido("/api/decisiones/enlaces", { decisionId: ids.decision, ordenId: venta.id }, tokenDueno));
    expect(aVieja.status).toBe(400);
    expect(await aVieja.json()).toMatchObject({ codigo: "DECISION_REEMPLAZADA" });
    const r = await postEnlace(pedido("/api/decisiones/enlaces", { decisionId: ids.corregida, ordenId: venta.id }, tokenDueno));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ decisionId: ids.corregida });
    expect(await db.enlaceDecisionOrden.count({ where: { ordenId: venta.id, decisionId: ids.corregida } })).toBe(1);
  });
});
