// Corregir el corte de una certificación ya cargada (frente certificacion-corte-real), contra la base de PRUEBAS.
// Un solo camino y una sola transacción, con el MISMO PDF: retira la certificación del corte equivocado (la historia
// queda: carga REVERTIDO con quién y cuándo, filas, conciliaciones), la importa con el corte real por el camino de
// siempre (filas nuevas, encargo cifrado con su llave) y re-verifica los cierres de los dos días (los del corte viejo
// quedan sin referencia; los del nuevo, contra la certificación), con sus conteos. Deja el siguiente paso: conciliar.
// Se rechaza sin cambiar nada (queda una carga RECHAZADO con el código, como en la importación) si no hay certificación
// vigente en el corte viejo, si el PDF es otro archivo, si el corte nuevo está ocupado, no es válido o tampoco es el
// real (señal 1), o si algo falla en medio. Datos inventados: julio a diciembre de 2027 con `hoy` inyectado; como
// proceso, solo rechazos que ocurren antes del reloj.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { corregirCorteCertificacion, type CorreccionCorte } from "@/importacion/av/corregir";
import { importarCertificacion } from "@/importacion/av/importar";
import { guardarCierresDeEspecies } from "@/precios/guardar";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../ayudas/cli";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const email = `dueno-corregir-${corrida.toLowerCase()}@ejemplo.invalid`;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
let duenoId = "";
let carpeta = "";
let n = 0;

/** «97211» → «97.211» (punto de miles, como el portal). */
const miles = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Dos especies con cifras raras, un fondo propio, y la CreationDate del PDF a las 18:05 del día dado (ya definitivo). */
function caso(creado: string, cantidad = "41") {
  n += 1;
  const nemos = ["A", "B"].map((l) => `C${corrida}${n}${l}`);
  const nit = `99713${String(n).padStart(3, "0")}-2`;
  const codigoFic = `5113${n}${corrida.replace(/\D/g, "1").slice(0, 3)}`;
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
    rentaVariable: [
      { nemo: nemos[0]!, cantidad, precio: "COP 2.371,00", valor: `COP ${miles(Number(cantidad) * 2371)},00` },
      { nemo: nemos[1]!, cantidad: "127", precio: "COP 63,17", valor: "COP 8.022,59" },
    ],
    creadoEn: `D:${creado.replace(/-/g, "")}180517-05'00'`,
  };
  return { nemos, nit, codigoFic, espec, pdf: generarCertificacionPdf(espec) };
}

type Caso = ReturnType<typeof caso>;
const sha = (c: Caso) => createHash("sha256").update(c.pdf).digest("hex");
const hoyDe = (d: string) => new Date(dia(d).getTime() + 3 * 86_400_000);

async function cargada(c: Caso, corte: string) {
  await db.instrumento.create({ data: { tipo: "FIC", codigoFic: c.codigoFic, nombre: "Fondo ficticio" } });
  const r = await importarCertificacion(db, { contenido: c.pdf, usuarioId: duenoId, fechaCorte: dia(corte), fondoCodigo: c.codigoFic, hoy: hoyDe(corte) });
  expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  return r;
}

const correccion = (c: Caso, de: string, a: string, extra: Partial<CorreccionCorte> = {}): CorreccionCorte => ({
  contenido: c.pdf, usuarioId: duenoId, fechaCorte: dia(de), nuevaFechaCorte: dia(a), hoy: hoyDe(de), ...extra,
});

/** Cierres de Yahoo por el camino único (se verifican al guardar): precios por especie y día. */
async function cierres(c: Caso, precios: Readonly<Record<string, readonly [string, string]>>, ahora: string) {
  const ids = await Promise.all(c.nemos.map(async (nemo) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: nemo } })).id));
  const fechas = Object.keys(precios).sort();
  const r = await guardarCierresDeEspecies(
    db,
    ids.map((instrumentoId, i) => ({ instrumentoId, traer: async () => ({ ok: true as const, cierres: fechas.map((f) => ({ fecha: dia(f), precio: precios[f]![i]!, volumen: 173 })) }) })),
    { desde: dia(fechas[0]!), hasta: dia(fechas.at(-1)!), ahora: new Date(`${ahora}T15:00:00Z`) },
  );
  expect(r.fallidas).toEqual([]);
  return ids;
}

/** Nada cambió: la certificación del corte viejo sigue vigente con su carga CARGADO, y el corte nuevo sigue libre. */
async function nadaCambio(de: string, a: string) {
  const vieja = await db.certificacion.findUnique({ where: { fechaCorte: dia(de) }, select: { retiradaEn: true, carga: { select: { estado: true } } } });
  if (vieja) expect(vieja).toEqual({ retiradaEn: null, carga: { estado: "CARGADO" } });
  return db.certificacion.count({ where: { fechaCorte: dia(a) } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  carpeta = mkdtempSync(join(tmpdir(), "inv-corregir-corte-"));
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("corregir el corte de una certificación ya cargada", () => {
  it("del martes 2027-07-13 al lunes 2027-07-12: retira, importa con el corte real, re-verifica los cierres y deja conciliar", async () => {
    const c = caso("2027-07-13");
    const primera = await cargada(c, "2027-07-13");
    const repetida = await importarCertificacion(db, { contenido: c.pdf, usuarioId: duenoId, fechaCorte: dia("2027-07-13"), hoy: hoyDe("2027-07-13") });
    expect(repetida.repetida).toBe(true);
    // Los precios de valoración son los del lunes; los del martes, otros. Al guardar, los del martes se verifican (mal)
    // contra la certificación del martes; los del lunes quedan sin referencia.
    const ids = await cierres(c, { "2027-07-12": ["2371", "63.17"], "2027-07-13": ["2371", "65.83"] }, "2027-07-16");
    const conciliada = await conciliarCertificacion(db, { fechaCorte: dia("2027-07-13") });
    expect(conciliada.corteSugerido).toBe("2027-07-12");
    const viejaId = primera.certificacionId!;

    const r = await corregirCorteCertificacion(db, correccion(c, "2027-07-13", "2027-07-12"));
    expect(r).toMatchObject({ estado: "CORREGIDO", codigo: null, retiradaId: viejaId, filas: primera.filasTotal, cargasRevertidas: 2, reverificados: { anterior: 2, nuevo: 2 } });

    // La vieja: retirada y reemplazada; sus cargas, REVERTIDO con quién y cuándo; su conciliación, intacta.
    const vieja = await db.certificacion.findUniqueOrThrow({ where: { id: viejaId }, select: { retiradaEn: true, reemplazadaPorId: true, fechaCorte: true } });
    expect(vieja).toMatchObject({ reemplazadaPorId: r.nuevaId, fechaCorte: dia("2027-07-13") });
    expect(vieja.retiradaEn).not.toBeNull();
    const cargasViejas = await db.cargaArchivo.findMany({ where: { sha256: sha(c), fechaCorte: dia("2027-07-13") }, select: { estado: true, revertidaPorId: true, revertidaEn: true } });
    expect(cargasViejas).toHaveLength(2);
    for (const cv of cargasViejas) expect(cv).toMatchObject({ estado: "REVERTIDO", revertidaPorId: duenoId, revertidaEn: expect.any(Date) });
    expect(await db.conciliacion.count({ where: { certificacionId: viejaId } })).toBe(1);

    // La nueva: su carga CARGADO del mismo archivo, sus filas (claves con el corte nuevo), posiciones y fondo cifrado.
    const nueva = await db.certificacion.findUniqueOrThrow({
      where: { id: r.nuevaId! },
      select: { fechaCorte: true, retiradaEn: true, carga: { select: { id: true, estado: true, sha256: true, cargadoPorId: true } }, posiciones: { select: { instrumentoId: true } }, fondos: { select: { encargo: true } } },
    });
    expect(nueva).toMatchObject({ fechaCorte: dia("2027-07-12"), retiradaEn: null, carga: { id: r.cargaId, estado: "CARGADO", sha256: sha(c), cargadoPorId: duenoId } });
    expect(nueva.posiciones.map((p) => p.instrumentoId).sort()).toEqual([...ids].sort());
    expect(nueva.fondos).toHaveLength(1);
    expect(nueva.fondos[0]!.encargo).not.toContain(CERTIFICACION_FICTICIA.fondos[0]!.encargo);
    expect(await db.filaFuente.count({ where: { primeraCargaId: r.cargaId! } })).toBe(primera.filasTotal);

    // Los cierres: los del martes sin referencia; los del lunes, verificados contra la certificación nueva.
    const vigentes = await db.precioCierre.findMany({ where: { instrumentoId: { in: ids }, reemplazadoEn: null }, select: { fecha: true, estado: true, fuenteReferencia: true } });
    const porDia = (d: string) => vigentes.filter((v) => iso(v.fecha) === d).map(({ estado, fuenteReferencia }) => ({ estado, fuenteReferencia }));
    expect(porDia("2027-07-13")).toEqual([{ estado: "NO_VERIFICADO", fuenteReferencia: null }, { estado: "NO_VERIFICADO", fuenteReferencia: null }]);
    expect(porDia("2027-07-12")).toEqual([{ estado: "VERIFICADO", fuenteReferencia: "certificacion:2027-07-12" }, { estado: "VERIFICADO", fuenteReferencia: "certificacion:2027-07-12" }]);

    // El siguiente paso: conciliar el corte nuevo. El viejo ya no se concilia.
    await expect(conciliarCertificacion(db, { fechaCorte: dia("2027-07-12") })).resolves.toMatchObject({ fechaCorte: "2027-07-12" });
    await expect(conciliarCertificacion(db, { fechaCorte: dia("2027-07-13") })).rejects.toMatchObject({ codigo: "CERTIFICACION_RETIRADA", reemplazo: "2027-07-12" });

    // Una segunda corrida: la del martes ya se retiró.
    expect(await corregirCorteCertificacion(db, correccion(c, "2027-07-13", "2027-07-12"))).toMatchObject({ estado: "RECHAZADO", codigo: "CORTE_RETIRADO" });
  });

  it("con otro PDF (otro archivo): ARCHIVO_DISTINTO, nada cambia y queda la carga RECHAZADO con el código", async () => {
    const c = caso("2027-07-27");
    await cargada(c, "2027-07-27");
    const otro = caso("2027-07-27", "43");
    const r = await corregirCorteCertificacion(db, correccion(otro, "2027-07-27", "2027-07-26"));
    expect(r).toMatchObject({ estado: "RECHAZADO", codigo: "ARCHIVO_DISTINTO", retiradaId: null, nuevaId: null });
    expect(await nadaCambio("2027-07-27", "2027-07-26")).toBe(0);
    const rechazo = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId! }, select: { estado: true, fechaCorte: true, errores: true } });
    expect(rechazo).toEqual({ estado: "RECHAZADO", fechaCorte: dia("2027-07-26"), errores: { total: 1, errores: [{ pagina: 0, fila: 0, columna: null, codigo: "ARCHIVO_DISTINTO" }] } });
  });

  it("sin certificación en el corte viejo: SIN_CERTIFICACION", async () => {
    const c = caso("2027-11-30");
    expect(await corregirCorteCertificacion(db, correccion(c, "2027-11-30", "2027-11-29"))).toMatchObject({ estado: "RECHAZADO", codigo: "SIN_CERTIFICACION" });
  });

  it("con el corte nuevo ocupado por otra certificación: CORTE_OCUPADO", async () => {
    const c = caso("2027-10-05");
    await cargada(c, "2027-10-05");
    await cargada(caso("2027-10-04", "47"), "2027-10-04");
    expect(await corregirCorteCertificacion(db, correccion(c, "2027-10-05", "2027-10-04"))).toMatchObject({ estado: "RECHAZADO", codigo: "CORTE_OCUPADO" });
    expect(await nadaCambio("2027-10-05", "2027-10-04")).toBe(1);
  });

  it("con un corte nuevo no hábil: FECHA_CORTE_NO_HABIL", async () => {
    const c = caso("2027-10-12");
    await cargada(c, "2027-10-12");
    expect(await corregirCorteCertificacion(db, correccion(c, "2027-10-12", "2027-10-10"))).toMatchObject({ estado: "RECHAZADO", codigo: "FECHA_CORTE_NO_HABIL" });
    expect(await nadaCambio("2027-10-12", "2027-10-10")).toBe(0);
  });

  it("si el corte nuevo tampoco es el real (señal 1): CORTE_NO_COINCIDE con el día que sugiere", async () => {
    const c = caso("2027-10-26");
    await cargada(c, "2027-10-26");
    // Valorados al viernes 2027-10-22 (el día hábil anterior al lunes 2027-10-25, el corte nuevo pedido).
    await cierres(c, { "2027-10-22": ["2371", "63.17"], "2027-10-25": ["2371", "66.07"] }, "2027-10-29");
    const r = await corregirCorteCertificacion(db, correccion(c, "2027-10-26", "2027-10-25"));
    expect(r).toMatchObject({ estado: "RECHAZADO", codigo: "CORTE_NO_COINCIDE", pistaCorte: { tipo: "PRECIOS", sugerido: "2027-10-22", especies: 2, distintas: 1 } });
    expect(await nadaCambio("2027-10-26", "2027-10-25")).toBe(0);
  });

  it("si algo falla en medio (la re-verificación), no queda nada a medias", async () => {
    const c = caso("2027-11-23");
    await cargada(c, "2027-11-23");
    const falla = Object.assign(new Error("detalle interno 37911"), { name: "ErrorFicticio" });
    const r = await corregirCorteCertificacion(db, correccion(c, "2027-11-23", "2027-11-22"), { reverificar: async () => Promise.reject(falla) });
    expect(r).toMatchObject({ estado: "RECHAZADO", codigo: "BASE_ERROR", nuevaId: null });
    expect(await nadaCambio("2027-11-23", "2027-11-22")).toBe(0);
    expect(await db.cargaArchivo.count({ where: { sha256: sha(c), estado: "CARGADO" } })).toBe(1);
    expect(await db.filaFuente.count({ where: { primeraCarga: { sha256: sha(c), fechaCorte: dia("2027-11-22") } } })).toBe(0);
  });

  it("solo el DUEÑO activo corrige", async () => {
    const c = caso("2027-12-07");
    const familia = await db.usuario.create({ data: { email: `familia-corregir-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "FAMILIA" } });
    await expect(corregirCorteCertificacion(db, correccion(c, "2027-12-07", "2027-12-06", { usuarioId: familia.id }))).rejects.toMatchObject({ codigo: "USUARIO_NO_AUTORIZADO" });
  });
});

describe("corregir-corte-certificacion como proceso", { timeout: 3 * POR_CLI_MS }, () => {
  const claves = (): Record<string, string> =>
    Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;

  it("sin certificación en el corte viejo: 1 con el código; sin correo, especies, cifras ni ruta", () => {
    const c = caso("2027-12-14");
    const ruta = join(carpeta, "cert.ficticio.pdf");
    writeFileSync(ruta, c.pdf);
    const s = correr("corregir-corte-certificacion.ts", ["--email", email, "--fecha-corte", "2027-12-14", "--nueva-fecha-corte", "2027-12-13", ruta], entornoMinimo({ DATABASE_URL: URL_BASE, ...claves() }));
    comprobar(s, 1, "SIN_CERTIFICACION", [email, ...c.nemos, c.nit, "2.371", "8.022,59", carpeta, URL_BASE, "postgresql://"]);
    expect(s.texto).toContain("No hay certificación con el corte 2027-12-14");
  });

  it("un correo que no está registrado: 1, sin repetirlo", () => {
    const ruta = join(carpeta, "cert.ficticio.pdf");
    const otro = `nadie-corregir-${corrida.toLowerCase()}@ejemplo.invalid`;
    const s = correr("corregir-corte-certificacion.ts", ["--email", otro, "--fecha-corte", "2027-12-14", "--nueva-fecha-corte", "2027-12-13", ruta], entornoMinimo({ DATABASE_URL: URL_BASE, ...claves() }));
    comprobar(s, 1, "USUARIO_NO_REGISTRADO", [otro]);
  });
});
