// Integración de la fase B, corte 1 (plan → regla → decisión → orden → resultado) contra la base de
// PRUEBAS. Datos inventados. El plan es uno solo para todo el portafolio y sus versiones no retroceden,
// así que los casos van en orden y comparten las versiones que crea el primero.
import { Prisma, PrismaClient, type LadoOrden, type EstadoOrden } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bloquearDecision } from "@/plan/bloqueos";
import { CHOQUES_CORRECCION, corregirDecision, registrarDecision } from "@/plan/decisiones";
import { CHOQUES_ENLACE, enlazarOrden } from "@/plan/enlaces";
import { ErrorPlan, traducirChoque } from "@/plan/errores";
import { sumarDias } from "@/plan/fechas";
import { resultadoDeDecision } from "@/plan/resultado-db";
import { listarOrdenesSinDecision } from "@/plan/sin-decision";
import { crearVersionPlan, versionVigente } from "@/plan/versiones";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-6);
const D = (v: string) => new Prisma.Decimal(v);
let n = 0;
let duenoId = "";
let familiaId = "";
let inactivoId = "";
let cargaId = "";
let instA = "";
let instB = "";
let base = new Date("2025-01-06T00:00:00.000Z");
const mas = (dias: number) => sumarDias(base, dias);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Tiempo que una transacción retiene un bloqueo mientras la otra escritura intenta pasar. */
const RETENCION_MS = 400;
const LARGO = "x".repeat(2001);

const ids = { v1: "", v2: "", reglasV1: [] as string[], reglasV2: [] as string[], noActuar: "", vender: "", vender2: "" };

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "SIN_ERROR";
  } catch (e) {
    return e instanceof ErrorPlan ? e.codigo : `OTRO: ${String(e)}`;
  }
}

async function nuevaOrden(o: { instrumentoId: string; lado: LadoOrden; fecha: Date; estado?: EstadoOrden; cantidad?: bigint; totalEstimado?: string }) {
  n += 1;
  const fila = await db.filaFuente.create({
    data: { tipoFuente: "TRII_ORDENES", claveNatural: `${corrida}-${n}`.padStart(64, "0"), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
  });
  const aprobada = (o.estado ?? "APROBADO") === "APROBADO";
  const cantidad = aprobada ? (o.cantidad ?? 100n) : 0n;
  return db.orden.create({
    data: {
      filaFuenteId: fila.id,
      ejecutadaEn: new Date(o.fecha.getTime() + 15 * 3_600_000),
      fechaOperacion: o.fecha,
      fechaLiquidacion: sumarDias(o.fecha, 2),
      instrumentoId: o.instrumentoId,
      lado: o.lado,
      estado: o.estado ?? "APROBADO",
      cantidadCompletada: cantidad,
      precioUnitario: D("10"),
      totalInvertido: D(aprobada ? "1000" : "0"),
      comision: D(aprobada ? "7" : "0"),
      totalEstimado: D(aprobada ? (o.totalEstimado ?? "993") : "0"),
    },
  });
}

const regla = (r: Partial<Parameters<typeof crearVersionPlan>[1]["reglas"][number]> & { instrumentoId: string | null }) => ({
  condicion: "NINGUNA" as const,
  nivel: null,
  accion: "NO_ACTUAR" as const,
  cantidad: null,
  plazoHasta: null,
  detalle: "Regla ficticia",
  ...r,
});

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-plan-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  familiaId = (await db.usuario.create({ data: { email: `familia-plan-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } })).id;
  inactivoId = (await db.usuario.create({ data: { email: `inactivo-plan-${corrida}@ejemplo.invalid`, rol: "DUENO", activo: false } })).id;
  cargaId = (
    await db.cargaArchivo.create({
      data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes.ficticio.csv", sha256: "b".repeat(64), estado: "CARGADO", cargadoPorId: duenoId },
    })
  ).id;
  instA = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PLA${corrida}`, nombre: "Acción ficticia A" } })).id;
  instB = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PLB${corrida}`, nombre: "Acción ficticia B" } })).id;
  // Si la base ya tiene versiones (otra corrida sin reinicio), se empieza después de la última.
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima) base = sumarDias(ultima.vigenteDesde, 1);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("versiones del plan (foto completa del día)", () => {
  it("crea la v1 y la v2 con sus reglas; la vigente depende de la fecha y la v1 queda en la historia", async () => {
    const v1 = await crearVersionPlan(db, {
      vigenteDesde: mas(0),
      motivo: "Plan inicial ficticio",
      autorId: duenoId,
      reglas: [
        regla({ instrumentoId: instA, cantidad: 50n, detalle: "Mantener hasta el dividendo" }),
        regla({ instrumentoId: instA, condicion: "CIERRE_BAJO", nivel: "9.5", accion: "VENDER", detalle: "Si cierra bajo el nivel, vender la mitad" }),
        regla({ instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: "1000", detalle: "No comprar por debajo del monto mínimo por orden" }),
      ],
    });
    const v2 = await crearVersionPlan(db, {
      vigenteDesde: mas(10),
      motivo: "Se baja el nivel de A y entra B",
      autorId: duenoId,
      reglas: [
        regla({ instrumentoId: instA, condicion: "CIERRE_BAJO", nivel: "9", accion: "VENDER", plazoHasta: mas(200), detalle: "Si cierra bajo el nivel, vender" }),
        regla({ instrumentoId: instB, accion: "COMPRAR", detalle: "Comprar B con lo de la venta" }),
        regla({ instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: "1000", detalle: "No comprar por debajo del monto mínimo por orden" }),
      ],
    });
    Object.assign(ids, { v1: v1.id, v2: v2.id, reglasV1: v1.reglaIds, reglasV2: v2.reglaIds });
    expect(v2.version).toBe(v1.version + 1);
    expect(v1.reglaIds).toHaveLength(3);
    expect((await versionVigente(db, mas(0)))?.id).toBe(v1.id);
    expect((await versionVigente(db, mas(9)))?.id).toBe(v1.id);
    expect((await versionVigente(db, mas(10)))?.id).toBe(v2.id);
    const reglaV1 = await db.reglaPlan.findUniqueOrThrow({ where: { id: v1.reglaIds[1]! } });
    expect([reglaV1.planVersionId, reglaV1.nivel?.toString(), reglaV1.accion]).toEqual([v1.id, "9.5", "VENDER"]);
    const guardada = await db.planVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect([guardada.aprobadaPorId, guardada.vigenteDesde]).toEqual([duenoId, mas(10)]);
  });

  it("la vigencia no retrocede", async () => {
    const intento = crearVersionPlan(db, { vigenteDesde: mas(5), motivo: "Atrás", autorId: duenoId, reglas: [regla({ instrumentoId: instA })] });
    expect(await codigo(intento)).toBe("VIGENCIA_RETROCEDE");
  });

  it("una vigencia a más de un año de hoy se rechaza y no escribe nada", async () => {
    const antes = await db.planVersion.count();
    const lejana = crearVersionPlan(db, { vigenteDesde: mas(400), motivo: "Año mal escrito", autorId: duenoId, reglas: [regla({ instrumentoId: instA })] }, { hoy: mas(20) });
    await expect(lejana).rejects.toHaveProperty("errores", [{ campo: "vigenteDesde", codigo: "VIGENCIA_DEMASIADO_LEJANA" }]);
    expect(await db.planVersion.count()).toBe(antes);
  });

  it("solo el dueño activo aprueba un plan", async () => {
    const datos = (autorId: string) => ({ vigenteDesde: mas(20), motivo: "Intento", autorId, reglas: [regla({ instrumentoId: instA })] });
    expect(await codigo(crearVersionPlan(db, datos(familiaId)))).toBe("AUTOR_NO_AUTORIZADO");
    expect(await codigo(crearVersionPlan(db, datos(inactivoId)))).toBe("AUTOR_NO_AUTORIZADO");
    expect(await codigo(crearVersionPlan(db, datos("no-existe")))).toBe("AUTOR_NO_AUTORIZADO");
  });

  it("los datos inválidos o una especie inexistente no escriben nada", async () => {
    const antes = await db.planVersion.count();
    const vacio = crearVersionPlan(db, { vigenteDesde: mas(20), motivo: " ", autorId: duenoId, reglas: [] });
    await expect(vacio).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    await expect(vacio).rejects.toHaveProperty("errores", expect.arrayContaining([{ campo: "motivo", codigo: "VACIO" }, { campo: "reglas", codigo: "SIN_REGLAS" }]));
    const sinEspecie = crearVersionPlan(db, { vigenteDesde: mas(20), motivo: "x", autorId: duenoId, reglas: [regla({ instrumentoId: "no-existe" })] });
    expect(await codigo(sinEspecie)).toBe("INSTRUMENTO_INEXISTENTE");
    expect(await db.planVersion.count()).toBe(antes);
  });

  it("varias versiones al mismo tiempo quedan con números consecutivos (no chocan)", async () => {
    const datos = { vigenteDesde: mas(30), motivo: "En paralelo", autorId: duenoId, reglas: [regla({ instrumentoId: instA })] };
    const creadas = await Promise.all(Array.from({ length: 5 }, () => crearVersionPlan(db, datos)));
    const numeros = creadas.map((c) => c.version).sort((a, b) => a - b);
    expect(numeros).toEqual(Array.from({ length: 5 }, (_, i) => numeros[0]! + i));
  });
});

describe("decisiones", () => {
  it("registra «no actuar» con la versión vigente en su fecha", async () => {
    const r = await registrarDecision(db, { fechaDecision: mas(12), instrumentoId: instA, accion: "NO_ACTUAR", cantidad: 50n, motivo: "Mantener hasta el dividendo", autorId: duenoId });
    ids.noActuar = r.id;
    const d = await db.decision.findUniqueOrThrow({ where: { id: r.id } });
    expect([d.planVersionId, d.accion, d.cantidad, d.reglaId, d.excepcion, d.decididaPorId]).toEqual([ids.v2, "NO_ACTUAR", 50n, null, false, duenoId]);
  });

  it("registra «vender» citando la regla de la versión vigente", async () => {
    const r = await registrarDecision(db, { fechaDecision: mas(12), instrumentoId: instA, accion: "VENDER", reglaId: ids.reglasV2[0]!, motivo: "Se tocó el nivel", autorId: duenoId });
    const r2 = await registrarDecision(db, { fechaDecision: mas(12), instrumentoId: instA, accion: "VENDER", motivo: "Otra venta", autorId: duenoId });
    Object.assign(ids, { vender: r.id, vender2: r2.id });
    expect(r.planVersionId).toBe(ids.v2);
  });

  it("rechaza una regla de otra versión o de otra especie, y una fecha sin plan", async () => {
    const d = { fechaDecision: mas(12), accion: "VENDER" as const, motivo: "x", autorId: duenoId };
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: instA, reglaId: ids.reglasV1[1]! }))).toBe("REGLA_DE_OTRA_VERSION");
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: instB, reglaId: ids.reglasV2[0]! }))).toBe("REGLA_DE_OTRA_ESPECIE");
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: instA, reglaId: "no-existe" }))).toBe("REGLA_INEXISTENTE");
    const primera = await db.planVersion.findFirstOrThrow({ orderBy: { version: "asc" } });
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: instA, fechaDecision: sumarDias(primera.vigenteDesde, -1) }))).toBe("SIN_PLAN");
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: "no-existe" }))).toBe("INSTRUMENTO_INEXISTENTE");
    expect(await codigo(registrarDecision(db, { ...d, instrumentoId: instA, autorId: familiaId }))).toBe("AUTOR_NO_AUTORIZADO");
  });

  it("una decisión con fecha futura se rechaza", async () => {
    const futura = registrarDecision(db, { fechaDecision: mas(13), instrumentoId: instA, accion: "VENDER", motivo: "Mañana", autorId: duenoId }, { hoy: mas(12) });
    await expect(futura).rejects.toHaveProperty("errores", [{ campo: "fechaDecision", codigo: "FECHA_FUTURA" }]);
  });

  it("una decisión espera a la versión que se está creando y queda bajo ella (no se cuela)", async () => {
    const enCurso: { decision?: Promise<{ planVersionId: string }> } = {};
    let nuevaId = "";
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inv008.plan_version'))`;
        const ultima = await tx.planVersion.findFirstOrThrow({ orderBy: { version: "desc" } });
        nuevaId = (await tx.planVersion.create({ data: { version: ultima.version + 1, vigenteDesde: mas(40), motivo: "Versión en curso", aprobadaPorId: duenoId } })).id;
        enCurso.decision = registrarDecision(db, { fechaDecision: mas(45), instrumentoId: instA, accion: "VENDER", motivo: "Durante la versión", autorId: duenoId });
        enCurso.decision.catch(() => undefined); // se espera abajo; evita el aviso de rechazo sin manejar mientras tanto
        await esperar(RETENCION_MS);
      },
      { timeout: 15_000 },
    );
    if (!enCurso.decision) throw new Error("la decisión no arrancó");
    expect((await enCurso.decision).planVersionId).toBe(nuevaId);
  });

  it("una excepción a una regla de portafolio cita la regla, con motivo", async () => {
    const d = { fechaDecision: mas(12), instrumentoId: instB, accion: "COMPRAR" as const, reglaId: ids.reglasV2[2]!, motivo: "Compra bajo el mínimo, aprobada", autorId: duenoId };
    expect(await codigo(registrarDecision(db, d))).toBe("ACCION_DISTINTA_SIN_EXCEPCION");
    const r = await registrarDecision(db, { ...d, excepcion: true });
    expect((await db.decision.findUniqueOrThrow({ where: { id: r.id } })).excepcion).toBe(true);
  });
});

describe("enlace de órdenes a decisiones", () => {
  it("una venta aprobada se enlaza a su decisión; cambiarla exige motivo y deja una cadena con un solo vigente", async () => {
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    const raiz = await enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender, autorId: duenoId });
    expect(raiz.reemplazaId).toBeNull();
    expect(await codigo(enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender, autorId: duenoId }))).toBe("YA_ENLAZADA_A_ESA_DECISION");
    expect(await codigo(enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender2, autorId: duenoId }))).toBe("ORDEN_YA_ENLAZADA");
    const correccion = await enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender2, autorId: duenoId, motivo: "Era la otra decisión" });
    expect(correccion.reemplazaId).toBe(raiz.id);
    const vuelta = await enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender, autorId: duenoId, motivo: "Se devuelve" });
    expect(vuelta.reemplazaId).toBe(correccion.id);
    const enlaces = await db.enlaceDecisionOrden.findMany({ where: { ordenId: venta.id }, include: { reemplazadoPor: true } });
    expect(enlaces).toHaveLength(3);
    expect(enlaces.filter((e) => e.reemplazadoPor === null).map((e) => e.id)).toEqual([vuelta.id]);
  });

  it("varios enlaces a la vez sobre la misma orden: uno entra y los demás fallan limpio", async () => {
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    const r = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => enlazarOrden(db, { ordenId: venta.id, decisionId: i % 2 === 0 ? ids.vender : ids.vender2, autorId: duenoId })),
    );
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const fallos = r.filter((x): x is PromiseRejectedResult => x.status === "rejected").map((x) => (x.reason instanceof ErrorPlan ? x.reason.codigo : String(x.reason)));
    expect(fallos.every((c) => c === "ORDEN_YA_ENLAZADA" || c === "YA_ENLAZADA_A_ESA_DECISION"), fallos.join(",")).toBe(true);
    expect(await db.enlaceDecisionOrden.count({ where: { ordenId: venta.id } })).toBe(1);
  });

  it("enlazar espera a una corrección en curso de la decisión y no enlaza a la reemplazada", async () => {
    const d = await registrarDecision(db, { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER", motivo: "Vender", autorId: duenoId });
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(15) });
    let enlace: Promise<string> = Promise.resolve("no arrancó");
    await db.$transaction(
      async (tx) => {
        // El mismo candado que toman enlazar y corregir (src/plan/bloqueos.ts): una de ellas «en curso».
        expect(await bloquearDecision(tx, d.id)).toBe(true);
        await tx.decision.create({
          data: { planVersionId: d.planVersionId, instrumentoId: instA, accion: "VENDER", motivo: "Corrección en curso", decididaPorId: duenoId, fechaDecision: mas(14), reemplazaId: d.id },
        });
        enlace = codigo(enlazarOrden(db, { ordenId: venta.id, decisionId: d.id, autorId: duenoId }));
        await esperar(RETENCION_MS);
      },
      { timeout: 15_000 },
    );
    expect(await enlace).toBe("DECISION_REEMPLAZADA");
    expect(await db.enlaceDecisionOrden.count({ where: { ordenId: venta.id } })).toBe(0);
  });

  it("corregir espera a un enlace en curso de la decisión y también lo mueve", async () => {
    const d = await registrarDecision(db, { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER", motivo: "Vender", autorId: duenoId });
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(15) });
    const enCurso: { correccion?: Promise<{ id: string }> } = {};
    await db.$transaction(
      async (tx) => {
        // El mismo candado que toman enlazar y corregir (src/plan/bloqueos.ts): una de ellas «en curso».
        expect(await bloquearDecision(tx, d.id)).toBe(true);
        await tx.enlaceDecisionOrden.create({ data: { ordenId: venta.id, decisionId: d.id, creadoPorId: duenoId } });
        enCurso.correccion = corregirDecision(db, d.id, { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER", motivo: "Vender (corregida)", autorId: duenoId });
        enCurso.correccion.catch(() => undefined); // se espera abajo
        await esperar(RETENCION_MS);
      },
      { timeout: 15_000 },
    );
    if (!enCurso.correccion) throw new Error("la corrección no arrancó");
    const nueva = await enCurso.correccion;
    const vigente = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { ordenId: venta.id, reemplazadoPor: { is: null } } });
    expect(vigente.decisionId).toBe(nueva.id);
  });

  it("si otro enlace raíz de la misma orden se está escribiendo, el choque del índice sale como ORDEN_YA_ENLAZADA", async () => {
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    let enlace: Promise<string> = Promise.resolve("no arrancó");
    await db.$transaction(
      async (tx) => {
        await tx.enlaceDecisionOrden.create({ data: { ordenId: venta.id, decisionId: ids.vender, creadoPorId: duenoId } });
        enlace = codigo(enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender2, autorId: duenoId }));
        await esperar(RETENCION_MS);
      },
      { timeout: 15_000 },
    );
    expect(await enlace).toBe("ORDEN_YA_ENLAZADA");
  });

  it("rechaza órdenes canceladas, de otra especie o lado, anteriores a la decisión y «no actuar»", async () => {
    const e = (ordenId: string, decisionId = ids.vender) => codigo(enlazarOrden(db, { ordenId, decisionId, autorId: duenoId }));
    expect(await e((await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13), estado: "CANCELADO" })).id)).toBe("ORDEN_NO_APROBADA");
    expect(await e((await nuevaOrden({ instrumentoId: instB, lado: "VENTA", fecha: mas(13) })).id)).toBe("ESPECIE_DISTINTA");
    expect(await e((await nuevaOrden({ instrumentoId: instA, lado: "COMPRA", fecha: mas(13), totalEstimado: "1007" })).id)).toBe("LADO_DISTINTO");
    expect(await e((await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(11) })).id)).toBe("ORDEN_ANTERIOR_A_LA_DECISION");
    expect(await e((await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) })).id, ids.noActuar)).toBe("NO_ACTUAR_SIN_ORDEN");
    expect(await e("no-existe")).toBe("ORDEN_INEXISTENTE");
    expect(await e((await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) })).id, "no-existe")).toBe("DECISION_INEXISTENTE");
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    expect(await codigo(enlazarOrden(db, { ordenId: venta.id, decisionId: ids.vender, autorId: familiaId }))).toBe("AUTOR_NO_AUTORIZADO");
  });

  it("corregir una decisión crea otra que la reemplaza y mueve sus enlaces vigentes", async () => {
    const original = await registrarDecision(db, { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER", cantidad: 30n, motivo: "Vender una parte", autorId: duenoId });
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(15) });
    const enlace = await enlazarOrden(db, { ordenId: venta.id, decisionId: original.id, autorId: duenoId });
    const datos = { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER" as const, cantidad: 20n, motivo: "Vender una parte (cantidad corregida)", autorId: duenoId };
    const nueva = await corregirDecision(db, original.id, datos);
    const guardada = await db.decision.findUniqueOrThrow({ where: { id: nueva.id } });
    expect([guardada.reemplazaId, guardada.cantidad]).toEqual([original.id, 20n]);
    const vigente = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { ordenId: venta.id, reemplazadoPor: { is: null } } });
    expect([vigente.decisionId, vigente.reemplazaId, vigente.motivo]).toEqual([nueva.id, enlace.id, `correccion:${original.id}`]);
    expect(await codigo(corregirDecision(db, original.id, datos))).toBe("DECISION_YA_REEMPLAZADA");
    const otra = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(15) });
    expect(await codigo(enlazarOrden(db, { ordenId: otra.id, decisionId: original.id, autorId: duenoId }))).toBe("DECISION_REEMPLAZADA");
    expect(await codigo(corregirDecision(db, "no-existe", datos))).toBe("DECISION_INEXISTENTE");
  });

  it("si la corrección no es coherente con sus órdenes, no se guarda nada", async () => {
    const original = await registrarDecision(db, { fechaDecision: mas(14), instrumentoId: instA, accion: "VENDER", motivo: "Vender", autorId: duenoId });
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(15) });
    await enlazarOrden(db, { ordenId: venta.id, decisionId: original.id, autorId: duenoId });
    const antes = await db.decision.count();
    const datos = { fechaDecision: mas(14), instrumentoId: instB, accion: "VENDER" as const, motivo: "Especie equivocada", autorId: duenoId };
    expect(await codigo(corregirDecision(db, original.id, datos))).toBe("ESPECIE_DISTINTA");
    expect(await db.decision.count()).toBe(antes);
  });
});

describe("órdenes sin decisión", () => {
  it("separa las anteriores al plan (sin alarma) de las que no tienen decisión registrada", async () => {
    const primera = await db.planVersion.findFirstOrThrow({ orderBy: { version: "asc" } });
    const anterior = await nuevaOrden({ instrumentoId: instB, lado: "COMPRA", fecha: sumarDias(primera.vigenteDesde, -3), totalEstimado: "1007" });
    const suelta = await nuevaOrden({ instrumentoId: instB, lado: "COMPRA", fecha: mas(16), totalEstimado: "1007" });
    const cancelada = await nuevaOrden({ instrumentoId: instB, lado: "COMPRA", fecha: mas(16), estado: "CANCELADO" });
    const enlazada = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(16) });
    await enlazarOrden(db, { ordenId: enlazada.id, decisionId: ids.vender, autorId: duenoId });

    const r = await listarOrdenesSinDecision(db);
    expect(r.inicioPlan).toEqual(primera.vigenteDesde);
    const propias = (lista: readonly { id: string }[]) => lista.map((o) => o.id).filter((id) => [anterior.id, suelta.id, cancelada.id, enlazada.id].includes(id));
    expect(propias(r.sinDecision)).toEqual([suelta.id]);
    expect(propias(r.anterioresAlPlan)).toEqual([anterior.id]);
    expect(r.sinDecision.find((o) => o.id === suelta.id)).toMatchObject({ filaFuenteId: suelta.filaFuenteId, instrumentoId: instB, lado: "COMPRA", cantidadCompletada: 100n });
  });
});

describe("resultado a 30 y 90 días con los cierres guardados", () => {
  const cierre = (instrumentoId: string, fecha: Date, precio: string, extra: Partial<Prisma.PrecioCierreUncheckedCreateInput> = {}) =>
    db.precioCierre.create({ data: { instrumentoId, fecha, precio: D(precio), fuente: "yahoo", estado: "VERIFICADO", ...extra } });

  it("«no actuar»: usa el cierre vigente de Yahoo, ignora el reemplazado y otras fuentes", async () => {
    await cierre(instA, mas(12), "10");
    await cierre(instA, mas(42), "99", { reemplazadoEn: new Date() });
    const vigente = await cierre(instA, mas(42), "11", { estado: "NO_VERIFICADO" });
    await cierre(instA, mas(42), "50", { fuente: "otra" });
    await cierre(instA, mas(102), "9");
    const r = await resultadoDeDecision(db, ids.noActuar, mas(400));
    expect(r.d30).toMatchObject({ estado: "CALCULADO", veredicto: "FUNCIONO", verificado: false, incluyeDividendos: false });
    expect(r.d30.resultadoPesos?.toString()).toBe("50");
    expect(r.d30.tramos[0]?.precioObjetivo?.id).toBe(vigente.id);
    expect(r.d90).toMatchObject({ estado: "CALCULADO", veredicto: "NO_FUNCIONO", verificado: true });
    expect(r.d90.resultadoPesos?.toString()).toBe("-50");
  });

  it("«vender»: se mide con la orden enlazada desde su ejecución; queda pendiente o sin precio según el caso", async () => {
    const d = await registrarDecision(db, { fechaDecision: mas(14), instrumentoId: instB, accion: "VENDER", motivo: "Vender B", autorId: duenoId });
    const venta = await nuevaOrden({ instrumentoId: instB, lado: "VENTA", fecha: mas(15), totalEstimado: "993" });
    await enlazarOrden(db, { ordenId: venta.id, decisionId: d.id, autorId: duenoId });
    await cierre(instB, mas(45), "9");
    const r = await resultadoDeDecision(db, d.id, mas(400));
    expect(r.d30.tramos.map((t) => t.ordenId)).toEqual([venta.id]);
    expect(r.d30.resultadoPesos?.toString()).toBe("93");
    expect(r.d90.estado).toBe("SIN_PRECIO");
    expect((await resultadoDeDecision(db, d.id, mas(30))).d30.estado).toBe("PENDIENTE");
  });

  it("una decisión inexistente es un error", async () => {
    expect(await codigo(resultadoDeDecision(db, "no-existe", mas(400)))).toBe("DECISION_INEXISTENTE");
  });
});

describe("reglas del plan escritas a mano en la migración", () => {
  it("existen los CHECK, el índice parcial y los disparadores de solo inserción del plan", async () => {
    const restricciones = (await db.$queryRaw<{ conname: string }[]>`SELECT conname FROM pg_constraint WHERE conname LIKE '%\_chk'`).map((r) => r.conname);
    for (const esperado of [
      "plan_version_version_chk",
      "plan_version_motivo_chk",
      "regla_plan_nivel_chk",
      "regla_plan_cantidad_chk",
      "regla_plan_detalle_chk",
      "decision_cantidad_chk",
      "decision_motivo_chk",
      "decision_excepcion_chk",
      "decision_reemplazo_chk",
      "enlace_decision_orden_reemplazo_chk",
      "enlace_decision_orden_motivo_chk",
    ]) {
      expect(restricciones, esperado).toContain(esperado);
    }
    const indices = await db.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE indexname = 'enlace_decision_orden_raiz_key'`;
    expect(indices).toHaveLength(1);
    const disparadores = await db.$queryRaw<{ tgname: string }[]>`
      SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname IN ('plan_version', 'regla_plan', 'decision', 'enlace_decision_orden') AND NOT t.tgisinternal`;
    // Más los de los instantes (migración *_instantes_base): la hora del registro la pone la base.
    expect(disparadores.map((d) => d.tgname).sort()).toEqual([
      "decision_instante",
      "decision_solo_insercion",
      "enlace_decision_orden_instante",
      "enlace_decision_orden_solo_insercion",
      "plan_version_instante",
      "plan_version_solo_insercion",
      "regla_plan_solo_insercion",
    ]);
  });

  it("nada del plan se edita ni se borra", async () => {
    const enlace = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { decisionId: ids.vender } });
    await expect(db.planVersion.update({ where: { id: ids.v1 }, data: { motivo: "otro" } })).rejects.toThrow(/solo inserción/);
    await expect(db.reglaPlan.delete({ where: { id: ids.reglasV1[0]! } })).rejects.toThrow(/solo inserción/);
    await expect(db.decision.update({ where: { id: ids.noActuar }, data: { motivo: "otro" } })).rejects.toThrow(/solo inserción/);
    await expect(db.enlaceDecisionOrden.delete({ where: { id: enlace.id } })).rejects.toThrow(/solo inserción/);
  });

  it("la salida de la reversión es la misma que la de los hechos importados", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
        await tx.decision.update({ where: { id: ids.noActuar }, data: { motivo: "dentro de la reversión" } });
        throw new Error("deshacer");
      }),
    ).rejects.toThrow("deshacer");
    expect((await db.decision.findUniqueOrThrow({ where: { id: ids.noActuar } })).motivo).toBe("Mantener hasta el dividendo");
  });

  it("los CHECK muerden aunque se salte el dominio", async () => {
    const dec = { planVersionId: ids.v2, instrumentoId: instA, motivo: "x", decididaPorId: duenoId, fechaDecision: mas(12) };
    await expect(db.decision.create({ data: { ...dec, accion: "NO_ACTUAR" } })).rejects.toThrow(/decision_cantidad_chk/);
    await expect(db.decision.create({ data: { ...dec, accion: "VENDER", cantidad: 0n } })).rejects.toThrow(/decision_cantidad_chk/);
    await expect(db.decision.create({ data: { ...dec, accion: "VENDER", motivo: "  " } })).rejects.toThrow(/decision_motivo_chk/);
    await expect(db.decision.create({ data: { ...dec, accion: "VENDER", excepcion: true } })).rejects.toThrow(/decision_excepcion_chk/);
    const r = { planVersionId: ids.v2, instrumentoId: instA, accion: "VENDER" as const, detalle: "x" };
    await expect(db.reglaPlan.create({ data: { ...r, condicion: "CIERRE_BAJO" } })).rejects.toThrow(/regla_plan_nivel_chk/);
    await expect(db.reglaPlan.create({ data: { ...r, condicion: "NINGUNA", nivel: D("1") } })).rejects.toThrow(/regla_plan_nivel_chk/);
    await expect(db.reglaPlan.create({ data: { ...r, condicion: "CIERRE_SOBRE", nivel: D("0") } })).rejects.toThrow(/regla_plan_nivel_chk/);
    await expect(db.reglaPlan.create({ data: { ...r, condicion: "NINGUNA", cantidad: -1n } })).rejects.toThrow(/regla_plan_cantidad_chk/);
    await expect(db.reglaPlan.create({ data: { ...r, condicion: "NINGUNA", detalle: "" } })).rejects.toThrow(/regla_plan_detalle_chk/);
    const v = { vigenteDesde: mas(500), aprobadaPorId: duenoId };
    await expect(db.planVersion.create({ data: { ...v, version: 0, motivo: "x" } })).rejects.toThrow(/plan_version_version_chk/);
    await expect(db.planVersion.create({ data: { ...v, version: 99_999, motivo: " " } })).rejects.toThrow(/plan_version_motivo_chk/);
  });

  it("las FK compuestas impiden citar una regla de otra versión y corregir el enlace de otra orden", async () => {
    const dec = { planVersionId: ids.v2, instrumentoId: instA, accion: "VENDER" as const, motivo: "x", decididaPorId: duenoId, fechaDecision: mas(12) };
    await expect(db.decision.create({ data: { ...dec, reglaId: ids.reglasV1[1]! } })).rejects.toThrow(/Foreign key constraint/);
    const enlace = await db.enlaceDecisionOrden.findFirstOrThrow({ where: { decisionId: ids.vender } });
    const otra = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    await expect(
      db.enlaceDecisionOrden.create({ data: { ordenId: otra.id, decisionId: ids.vender, reemplazaId: enlace.id, motivo: "x", creadoPorId: duenoId } }),
    ).rejects.toThrow(/Foreign key constraint/);
  });

  it("una orden tiene un solo enlace raíz, y una corrección exige motivo y no se apunta a sí misma", async () => {
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    const e = { ordenId: venta.id, decisionId: ids.vender, creadoPorId: duenoId };
    const raiz = await db.enlaceDecisionOrden.create({ data: e });
    await expect(db.enlaceDecisionOrden.create({ data: e })).rejects.toThrow(/Unique constraint failed|enlace_decision_orden_raiz_key/);
    await expect(db.enlaceDecisionOrden.create({ data: { ...e, reemplazaId: raiz.id } })).rejects.toThrow(/enlace_decision_orden_reemplazo_chk/);
    await expect(db.enlaceDecisionOrden.create({ data: { ...e, id: "auto-ref", reemplazaId: "auto-ref", motivo: "x" } })).rejects.toThrow(
      /enlace_decision_orden_reemplazo_chk|Foreign key constraint/,
    );
    const dec = { planVersionId: ids.v2, instrumentoId: instA, accion: "VENDER" as const, motivo: "x", decididaPorId: duenoId, fechaDecision: mas(12) };
    await expect(db.decision.create({ data: { ...dec, id: "auto-ref-d", reemplazaId: "auto-ref-d" } })).rejects.toThrow(
      /decision_reemplazo_chk|Foreign key constraint/,
    );
  });

  it("los choques de unicidad reales se traducen a códigos del plan", async () => {
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    const e = { ordenId: venta.id, decisionId: ids.vender, creadoPorId: duenoId };
    const raiz = await db.enlaceDecisionOrden.create({ data: e });
    const choqueRaiz = await db.enlaceDecisionOrden.create({ data: e }).catch((x: unknown) => x);
    expect(choqueRaiz).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(traducirChoque(choqueRaiz, CHOQUES_ENLACE)).toMatchObject({ codigo: "ORDEN_YA_ENLAZADA" });
    const correccion = { ...e, reemplazaId: raiz.id, motivo: "x" };
    await db.enlaceDecisionOrden.create({ data: correccion });
    const choqueCorreccion = await db.enlaceDecisionOrden.create({ data: correccion }).catch((x: unknown) => x);
    expect(traducirChoque(choqueCorreccion, CHOQUES_ENLACE)).toMatchObject({ codigo: "ENLACE_YA_REEMPLAZADO" });
    expect(traducirChoque(choqueCorreccion, CHOQUES_CORRECCION)).toMatchObject({ codigo: "ENLACE_YA_REEMPLAZADO" });
    const dec = { planVersionId: ids.v2, instrumentoId: instA, accion: "VENDER" as const, motivo: "x", decididaPorId: duenoId, fechaDecision: mas(12), reemplazaId: ids.vender2 };
    await db.decision.create({ data: dec });
    const choqueDecision = await db.decision.create({ data: dec }).catch((x: unknown) => x);
    expect(traducirChoque(choqueDecision, CHOQUES_CORRECCION)).toMatchObject({ codigo: "DECISION_YA_REEMPLAZADA" });
  });

  it("los textos no pasan de 2000 caracteres tampoco en la base", async () => {
    await expect(db.planVersion.create({ data: { version: 99_998, vigenteDesde: mas(500), motivo: LARGO, aprobadaPorId: duenoId } })).rejects.toThrow(/plan_version_motivo_chk/);
    await expect(db.reglaPlan.create({ data: { planVersionId: ids.v2, instrumentoId: instA, condicion: "NINGUNA", accion: "VENDER", detalle: LARGO } })).rejects.toThrow(
      /regla_plan_detalle_chk/,
    );
    const dec = { planVersionId: ids.v2, instrumentoId: instA, accion: "VENDER" as const, decididaPorId: duenoId, fechaDecision: mas(12) };
    await expect(db.decision.create({ data: { ...dec, motivo: LARGO } })).rejects.toThrow(/decision_motivo_chk/);
    const venta = await nuevaOrden({ instrumentoId: instA, lado: "VENTA", fecha: mas(13) });
    await expect(db.enlaceDecisionOrden.create({ data: { ordenId: venta.id, decisionId: ids.vender, creadoPorId: duenoId, motivo: LARGO } })).rejects.toThrow(
      /enlace_decision_orden_motivo_chk/,
    );
  });
});
