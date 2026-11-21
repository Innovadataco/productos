// Integración del enlace de un solo uso (D-014) contra la base de PRUEBAS: emitir (crea o reutiliza el
// dueño), definir la clave (una vez, antes de 30 min, solo el más reciente) y su registro con IP y hora.
// Datos inventados: correos `@ejemplo.invalid`, IP de documentación, contraseñas ficticias.
// La creación del primer dueño (base sin dueños) la ejerce la siembra del E2E (tests/e2e/sembrar.ts).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorAcceso, definirClave, emitirAcceso, hashToken } from "@/auth/acceso";
import { compararClave } from "@/auth/clave";
import { ingresar } from "@/auth/ingreso";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-acceso-1";
const NUEVA = "clave-ficticia-acceso-2";
let n = 0;
const correo = () => `acceso-${corrida}-${(n += 1)}@ejemplo.invalid`;
const ipNueva = () => `192.0.2.${(n += 1) % 250}`;
const reloj = (horas: number) => (min = 0) => new Date(Date.UTC(2031, 0, 1) + horas * 3_600_000 + min * 60_000);

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "SIN_ERROR";
  } catch (e) {
    return e instanceof ErrorAcceso ? e.codigo : `OTRO: ${String(e)}`;
  }
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("emitirAcceso", () => {
  it("a un dueño sin clave le da un enlace INICIAL de 30 min y guarda solo el sha256", async () => {
    const email = correo();
    const u = await db.usuario.create({ data: { email, rol: "DUENO" } });
    const t = reloj(1);
    const r = await emitirAcceso(db, { email, ahora: t() });
    expect(r).toMatchObject({ usuarioId: u.id, creado: false, proposito: "INICIAL" });
    const filas = await db.tokenAcceso.findMany({ where: { usuarioId: u.id } });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.tokenHash).toBe(hashToken(r.token));
    expect(JSON.stringify(filas)).not.toContain(r.token);
    expect(filas[0]?.venceEn.getTime()).toBe(t(30).getTime());
  });

  it("a un dueño con clave le da un enlace de RECUPERACION", async () => {
    const email = correo();
    await db.usuario.create({ data: { email, rol: "DUENO", claveHash: `$2b$12$${"c".repeat(53)}` } });
    expect((await emitirAcceso(db, { email, ahora: reloj(2)() })).proposito).toBe("RECUPERACION");
  });

  it("no crea un segundo dueño con otro correo ni toca una cuenta que no es DUENO", async () => {
    await db.usuario.create({ data: { email: correo(), rol: "DUENO" } });
    expect(await codigo(emitirAcceso(db, { email: correo(), ahora: reloj(3)() }))).toBe("OTRO_DUENO");
    const familia = correo();
    await db.usuario.create({ data: { email: familia, rol: "FAMILIA" } });
    expect(await codigo(emitirAcceso(db, { email: familia, ahora: reloj(3)() }))).toBe("ROL_DISTINTO");
  });
});

describe("definirClave", () => {
  async function dueno(horas: number) {
    const email = correo();
    const u = await db.usuario.create({ data: { email, rol: "DUENO", bloqueadoHasta: reloj(horas)(60), sesionVersion: 3 } });
    const { token } = await emitirAcceso(db, { email, ahora: reloj(horas)() });
    return { ...u, token };
  }

  it("con un enlace vigente fija la clave, sube la sesión, limpia el bloqueo, lo marca usado y lo registra", async () => {
    const u = await dueno(10);
    const ip = ipNueva();
    const r = await definirClave(db, { token: u.token, clave: CLAVE, ip, ahora: reloj(10)(5) });
    expect(r).toEqual({ ok: true, usuarioId: u.id });
    const despues = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(await compararClave(CLAVE, despues.claveHash)).toBe(true);
    expect(despues.sesionVersion).toBe(4);
    expect(despues.bloqueadoHasta).toBeNull();
    expect((await db.tokenAcceso.findUniqueOrThrow({ where: { tokenHash: hashToken(u.token) } })).usadoEn).toEqual(reloj(10)(5));
    expect(await db.intentoIngreso.findMany({ where: { usuarioId: u.id }, select: { resultado: true, ip: true, ocurridoEn: true } })).toEqual([
      { resultado: "CLAVE_DEFINIDA", ip, ocurridoEn: reloj(10)(5) },
    ]);
    // Con la clave nueva ya puede entrar.
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: reloj(10)(6) })).toMatchObject({ ok: true });
  });

  it("el enlace sirve una sola vez", async () => {
    const u = await dueno(11);
    await definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(11)(1) });
    expect(await definirClave(db, { token: u.token, clave: NUEVA, ip: ipNueva(), ahora: reloj(11)(2) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    const despues = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(await compararClave(CLAVE, despues.claveHash)).toBe(true);
  });

  it("vence a los 30 minutos", async () => {
    const u = await dueno(12);
    expect(await definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(12)(30) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).claveHash).toBeNull();
  });

  it("emitir uno nuevo deja sin valor los anteriores", async () => {
    const u = await dueno(13);
    const { token: nuevo } = await emitirAcceso(db, { email: u.email, ahora: reloj(13)(1) });
    expect(await definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(13)(2) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect(await definirClave(db, { token: nuevo, clave: CLAVE, ip: ipNueva(), ahora: reloj(13)(3) })).toMatchObject({ ok: true });
  });

  it("un token inventado da la misma respuesta genérica y queda registrado sin usuario, con su IP", async () => {
    const ip = ipNueva();
    expect(await definirClave(db, { token: "x".repeat(43), clave: CLAVE, ip, ahora: reloj(14)() })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect(await db.intentoIngreso.findMany({ where: { ip }, select: { resultado: true, usuarioId: true } })).toEqual([
      { resultado: "TOKEN_INVALIDO", usuarioId: null },
    ]);
  });

  it("una clave fuera de 12 a 72 bytes no gasta el enlace", async () => {
    const u = await dueno(15);
    expect(await definirClave(db, { token: u.token, clave: "corta", ip: ipNueva(), ahora: reloj(15)(1) })).toEqual({ ok: false, motivo: "CLAVE_INVALIDA" });
    expect(await definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(15)(2) })).toMatchObject({ ok: true });
  });

  it("comparte el tope por IP del ingreso: 20 fallos cortan la IP aun con un enlace vigente", async () => {
    const u = await dueno(16);
    const ip = "192.0.2.251";
    for (let k = 0; k < 20; k += 1) await definirClave(db, { token: `${"y".repeat(42)}${k % 10}`, clave: CLAVE, ip, ahora: reloj(16)(1) });
    expect(await definirClave(db, { token: u.token, clave: CLAVE, ip, ahora: reloj(16)(2) })).toEqual({ ok: false, motivo: "IP_LIMITADA" });
    expect(await definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(16)(3) })).toMatchObject({ ok: true });
  }, 30_000);

  it("después de definir la clave, los fallos de antes ya no cuentan para el bloqueo", async () => {
    const email = correo();
    await db.usuario.create({ data: { email, rol: "DUENO" } });
    const t = reloj(17);
    const primero = await emitirAcceso(db, { email, ahora: t() });
    await definirClave(db, { token: primero.token, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
    for (let k = 0; k < 4; k += 1) await ingresar(db, { email, clave: NUEVA, ip: ipNueva(), ahora: t(2) });
    const segundo = await emitirAcceso(db, { email, ahora: t(3) });
    await definirClave(db, { token: segundo.token, clave: NUEVA, ip: ipNueva(), ahora: t(4) });
    await ingresar(db, { email, clave: CLAVE, ip: ipNueva(), ahora: t(5) });
    expect((await db.usuario.findUniqueOrThrow({ where: { email } })).bloqueadoHasta).toBeNull();
  }, 30_000);

  it("carrera: dos definirClave en paralelo con el mismo enlace, gana exactamente una", async () => {
    const u = await dueno(18);
    const [a, b] = await Promise.all([
      definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(18)(1) }),
      definirClave(db, { token: u.token, clave: NUEVA, ip: ipNueva(), ahora: reloj(18)(1) }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].filter((r) => !r.ok && r.motivo === "TOKEN_INVALIDO")).toHaveLength(1);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).sesionVersion).toBe(4);
  }, 30_000);

  it("carrera: definirClave contra emitirAcceso deja un estado coherente", async () => {
    const u = await dueno(19);
    const [definido, nuevo] = await Promise.all([
      definirClave(db, { token: u.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(19)(1) }),
      emitirAcceso(db, { email: u.email, ahora: reloj(19)(1) }),
    ]);
    const viejo = await db.tokenAcceso.findUniqueOrThrow({ where: { tokenHash: hashToken(u.token) } });
    if (definido.ok) expect(viejo.usadoEn).not.toBeNull();
    else expect(definido).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    // El enlace nuevo vale siempre: es el más reciente y no se usó.
    expect(await definirClave(db, { token: nuevo.token, clave: NUEVA, ip: ipNueva(), ahora: reloj(19)(2) })).toMatchObject({ ok: true });
  }, 30_000);

  it("carrera: un ingreso con la clave vieja contra definirClave nunca deja una sesión válida con la clave vieja", async () => {
    const email = correo();
    await db.usuario.create({ data: { email, rol: "DUENO" } });
    const t = reloj(20);
    const primero = await emitirAcceso(db, { email, ahora: t() });
    await definirClave(db, { token: primero.token, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
    const segundo = await emitirAcceso(db, { email, ahora: t(2) });
    const [entrada] = await Promise.all([
      ingresar(db, { email, clave: CLAVE, ip: ipNueva(), ahora: t(3) }),
      definirClave(db, { token: segundo.token, clave: NUEVA, ip: ipNueva(), ahora: t(3) }),
    ]);
    const final = await db.usuario.findUniqueOrThrow({ where: { email } });
    if (entrada.ok) expect(entrada.sesionVersion).toBeLessThan(final.sesionVersion);
    expect(await compararClave(NUEVA, final.claveHash)).toBe(true);
  }, 30_000);
});
