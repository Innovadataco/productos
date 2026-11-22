// El acceso de un familiar (frente familia-lectura) contra la base de PRUEBAS. Mismo modelo que el del dueño: un enlace
// de un solo uso (solo su sha256 en la base, 30 min, vale el más reciente), su propia clave y su propio TOTP; con
// sesión, rol FAMILIA (solo lectura). Revocar lo desactiva y le cierra todo (sesión, pre-sesión, enlace y clave). El
// reinicio de su TOTP es el del dueño, por su propio comando. Lo de cada rol no toca al otro.
// Datos inventados: correos `@ejemplo.invalid`, IP de documentación, contraseñas ficticias, relojes de 2027.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorAcceso, definirClave, emitirAcceso, hashToken } from "@/auth/acceso";
import { confirmarEnrolamiento } from "@/auth/enrolamiento";
import { ErrorFamiliar, emitirAccesoFamiliar, reiniciarTotpFamiliar, revocarFamiliar } from "@/auth/familia";
import { ingresar } from "@/auth/ingreso";
import { reiniciarTotp } from "@/auth/reinicio-totp";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { verificarSegundoPaso } from "@/auth/segundo-paso";
import { validarSesion } from "@/auth/sesion";
import { firmarToken } from "@/auth/token";
import { hotp, pasoDe } from "@/auth/totp";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-familiar-4613";
const CLAVE_SESION = new TextEncoder().encode("k".repeat(32));
let n = 0;
const correo = () => `familiar-${corrida}-${(n += 1)}@ejemplo.invalid`;
/** Una /64 de documentación (RFC 3849) por intento y por corrida. */
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:f${(n += 1).toString(16)}::1`;
/** Relojes de 2027 (cada prueba el suyo): nada se cruza con la historia real ni con otras pruebas. */
const reloj = (dia: number) => (min = 0) => new Date(Date.UTC(2027, 4, dia, 15) + min * 60_000);

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "SIN_ERROR";
  } catch (e) {
    if (e instanceof ErrorFamiliar || e instanceof ErrorAcceso) return e.codigo;
    return `OTRO: ${String(e)}`;
  }
}

const fila = (email: string) => db.usuario.findUniqueOrThrow({ where: { email } });

interface Familiar {
  readonly id: string;
  readonly email: string;
  readonly secreto: Buffer;
  readonly sesionVersion: number;
  readonly codigos: readonly string[];
}

/** El camino completo de un familiar: alta → enlace → clave → primer ingreso → TOTP enrolado (con sesión). */
async function familiarEnrolado(t: (min?: number) => Date): Promise<Familiar> {
  const email = correo();
  const alta = await emitirAccesoFamiliar(db, { email, ahora: t() });
  const definida = await definirClave(db, { token: alta.token, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
  if (!definida.ok) throw new Error(`no definió la clave: ${definida.motivo}`);
  const paso = await ingresar(db, { email, clave: CLAVE, ip: ipNueva(), ahora: t(2) });
  if (!paso.ok || paso.paso !== "enrolar") throw new Error("el familiar debía quedar para enrolar el TOTP");
  const secreto = descifrarSecretoTotp((await fila(email)).totpSecreto, alta.usuarioId);
  const presesion = { sub: alta.usuarioId, sesionVersion: paso.sesionVersion, jti: paso.jti };
  const enrolado = await confirmarEnrolamiento(db, { presesion, codigo: hotp(secreto, pasoDe(t(3).getTime())), ip: ipNueva(), ahora: t(3) });
  if (!enrolado.ok) throw new Error(`no enroló: ${enrolado.motivo}`);
  return { id: alta.usuarioId, email, secreto, sesionVersion: enrolado.sesionVersion, codigos: enrolado.codigos };
}

const sesionDe = async (f: { id: string; sesionVersion: number }, ahora: Date) =>
  validarSesion(db, await firmarToken({ sub: f.id, sesionVersion: f.sesionVersion }, CLAVE_SESION, ahora.getTime()), CLAVE_SESION, ahora.getTime());

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("emitirAccesoFamiliar", () => {
  it("crea el familiar activo y sin clave, con un enlace INICIAL de 30 min del que la base guarda solo el sha256", async () => {
    const email = correo();
    const t = reloj(3);
    const duenos = await db.usuario.count({ where: { rol: "DUENO" } });
    const r = await emitirAccesoFamiliar(db, { email, ahora: t() });
    expect(r).toMatchObject({ creado: true, proposito: "INICIAL" });
    expect(await fila(email)).toMatchObject({ id: r.usuarioId, rol: "FAMILIA", activo: true, claveHash: null, totpActivadoEn: null });
    const tokens = await db.tokenAcceso.findMany({ where: { usuarioId: r.usuarioId } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).toBe(hashToken(r.token));
    expect(JSON.stringify(tokens)).not.toContain(r.token);
    expect(tokens[0]?.venceEn.getTime()).toBe(t(30).getTime());
    expect(await db.usuario.count({ where: { rol: "DUENO" } })).toBe(duenos);
  });

  it("sin clave da otro INICIAL; con clave, RECUPERACION; y solo vale el enlace más reciente", async () => {
    const email = correo();
    const t = reloj(4);
    const primero = await emitirAccesoFamiliar(db, { email, ahora: t() });
    const segundo = await emitirAccesoFamiliar(db, { email, ahora: t(1) });
    expect(segundo).toMatchObject({ usuarioId: primero.usuarioId, creado: false, proposito: "INICIAL" });
    expect(await definirClave(db, { token: primero.token, clave: CLAVE, ip: ipNueva(), ahora: t(2) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect(await definirClave(db, { token: segundo.token, clave: CLAVE, ip: ipNueva(), ahora: t(3) })).toEqual({ ok: true, usuarioId: primero.usuarioId });
    expect((await emitirAccesoFamiliar(db, { email, ahora: t(4) })).proposito).toBe("RECUPERACION");
  });

  it("no toca el correo del dueño, y el comando del dueño no toca al familiar", async () => {
    const dueno = correo();
    await db.usuario.create({ data: { email: dueno, rol: "DUENO" } });
    expect(await codigo(emitirAccesoFamiliar(db, { email: dueno, ahora: reloj(5)() }))).toBe("ES_DEL_DUENO");
    expect(await db.tokenAcceso.count({ where: { usuario: { email: dueno } } })).toBe(0);
    const familiar = correo();
    await emitirAccesoFamiliar(db, { email: familiar, ahora: reloj(5)() });
    expect(await codigo(emitirAcceso(db, { email: familiar, ahora: reloj(5)(1) }))).toBe("ROL_DISTINTO");
  });

  it("dos altas a la vez del mismo correo crean UN familiar y solo vale el enlace más reciente", async () => {
    const email = correo();
    const t = reloj(8);
    const [a, b] = await Promise.all([emitirAccesoFamiliar(db, { email, ahora: t() }), emitirAccesoFamiliar(db, { email, ahora: t(1) })]);
    expect(a.usuarioId).toBe(b.usuarioId);
    expect([a.creado, b.creado].filter(Boolean)).toHaveLength(1);
    expect(await db.usuario.count({ where: { email } })).toBe(1);
    const definidas = await Promise.all([a, b].map((r, k) => definirClave(db, { token: r.token, clave: CLAVE, ip: ipNueva(), ahora: t(2 + k) })));
    expect(definidas.filter((d) => d.ok)).toHaveLength(1);
    expect(definidas[1]).toEqual({ ok: true, usuarioId: a.usuarioId });
  });

  it("el enlace exige una cuenta activa, también la del dueño (endurecimiento: un dueño inactivo no define clave)", async () => {
    const email = correo();
    await db.usuario.create({ data: { email, rol: "DUENO", activo: false } });
    const r = await emitirAcceso(db, { email, ahora: reloj(9)() });
    expect(await definirClave(db, { token: r.token, clave: CLAVE, ip: ipNueva(), ahora: reloj(9)(1) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect((await fila(email)).claveHash).toBeNull();
  });

  it("a un familiar revocado no le da enlace (REVOCADO) ni cambia nada: no se reactiva", async () => {
    const email = correo();
    const t = reloj(6);
    await emitirAccesoFamiliar(db, { email, ahora: t() });
    await revocarFamiliar(db, { email, ahora: t(1) });
    const antes = await fila(email);
    const tokens = await db.tokenAcceso.count({ where: { usuarioId: antes.id } });
    expect(await codigo(emitirAccesoFamiliar(db, { email, ahora: t(2) }))).toBe("REVOCADO");
    expect(await fila(email)).toEqual(antes);
    expect(await db.tokenAcceso.count({ where: { usuarioId: antes.id } })).toBe(tokens);
  });
});

describe("del enlace a la sesión: el mismo modelo del dueño", () => {
  it("define su clave, pasa la clave, enrola su propio TOTP (10 códigos) y tiene sesión con rol FAMILIA", async () => {
    const t = reloj(7);
    const f = await familiarEnrolado(t);
    expect(f.codigos).toHaveLength(10);
    expect(await sesionDe(f, t(4))).toEqual({ id: f.id, email: f.email, rol: "FAMILIA" });
    const despues = await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(5) });
    expect(despues).toMatchObject({ ok: true, paso: "totp" });
  });
});

describe("recuperación de la clave de un familiar con TOTP", () => {
  it("el enlace de RECUPERACION cambia la clave, cierra sus sesiones y conserva su TOTP (no vuelve a enrolar)", async () => {
    const t = reloj(20);
    const f = await familiarEnrolado(t);
    const r = await emitirAccesoFamiliar(db, { email: f.email, ahora: t(10) });
    expect(r.proposito).toBe("RECUPERACION");
    const nueva = "clave-ficticia-familiar-3791";
    expect(await definirClave(db, { token: r.token, clave: nueva, ip: ipNueva(), ahora: t(11) })).toEqual({ ok: true, usuarioId: f.id });
    expect(await sesionDe(f, t(12))).toBeNull();
    expect((await fila(f.email)).totpActivadoEn).not.toBeNull();
    expect(await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(13) })).toEqual({ ok: false, motivo: "CLAVE_INCORRECTA" });
    expect(await ingresar(db, { email: f.email, clave: nueva, ip: ipNueva(), ahora: t(14) })).toMatchObject({ ok: true, paso: "totp" });
  });
});

describe("revocarFamiliar", () => {
  it("lo desactiva y le cierra todo: sesión, pre-sesión, enlace pendiente y clave", async () => {
    const t = reloj(10);
    const f = await familiarEnrolado(t);
    const paso = await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(4) });
    if (!paso.ok) throw new Error("debía pasar la clave");
    const pendiente = await emitirAccesoFamiliar(db, { email: f.email, ahora: t(5) });
    const antes = await fila(f.email);

    expect(await revocarFamiliar(db, { email: f.email, ahora: t(6) })).toEqual({ usuarioId: f.id, yaEstaba: false });

    const despues = await fila(f.email);
    expect(despues).toMatchObject({ activo: false, presesionHash: null, sesionVersion: antes.sesionVersion + 1 });
    expect(await sesionDe(f, t(7))).toBeNull();
    const presesion = { sub: f.id, sesionVersion: paso.sesionVersion, jti: paso.jti };
    expect(await verificarSegundoPaso(db, { presesion, codigo: hotp(f.secreto, pasoDe(t(7).getTime())), ip: ipNueva(), ahora: t(7) })).toEqual({
      ok: false,
      motivo: "PRESESION_INVALIDA",
    });
    expect(await definirClave(db, { token: pendiente.token, clave: "otra-clave-ficticia-familiar", ip: ipNueva(), ahora: t(8) })).toEqual({ ok: false, motivo: "TOKEN_INVALIDO" });
    expect(await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(9) })).toEqual({ ok: false, motivo: "CUENTA_INACTIVA" });
  });

  it("revocado a medio enrolar: su pre-sesión ya no activa el TOTP pendiente", async () => {
    const email = correo();
    const t = reloj(13);
    const alta = await emitirAccesoFamiliar(db, { email, ahora: t() });
    await definirClave(db, { token: alta.token, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
    const paso = await ingresar(db, { email, clave: CLAVE, ip: ipNueva(), ahora: t(2) });
    if (!paso.ok || paso.paso !== "enrolar") throw new Error("debía quedar para enrolar");
    const secreto = descifrarSecretoTotp((await fila(email)).totpSecreto, alta.usuarioId);
    await revocarFamiliar(db, { email, ahora: t(3) });
    const presesion = { sub: alta.usuarioId, sesionVersion: paso.sesionVersion, jti: paso.jti };
    expect(await confirmarEnrolamiento(db, { presesion, codigo: hotp(secreto, pasoDe(t(4).getTime())), ip: ipNueva(), ahora: t(4) })).toEqual({
      ok: false,
      motivo: "PRESESION_INVALIDA",
    });
    expect(await fila(email)).toMatchObject({ activo: false, totpActivadoEn: null });
  });

  it("es idempotente: la segunda vez dice que ya estaba y no cambia nada", async () => {
    const email = correo();
    const t = reloj(11);
    await emitirAccesoFamiliar(db, { email, ahora: t() });
    await revocarFamiliar(db, { email, ahora: t(1) });
    const antes = await fila(email);
    expect((await revocarFamiliar(db, { email, ahora: t(2) })).yaEstaba).toBe(true);
    expect(await fila(email)).toEqual(antes);
  });

  it("no toca al dueño (ES_DEL_DUENO) ni a un correo que no existe (NO_EXISTE)", async () => {
    const dueno = correo();
    await db.usuario.create({ data: { email: dueno, rol: "DUENO" } });
    const antes = await fila(dueno);
    expect(await codigo(revocarFamiliar(db, { email: dueno, ahora: reloj(12)() }))).toBe("ES_DEL_DUENO");
    expect(await fila(dueno)).toEqual(antes);
    expect(await codigo(revocarFamiliar(db, { email: correo(), ahora: reloj(12)() }))).toBe("NO_EXISTE");
  });
});

describe("reiniciarTotpFamiliar", () => {
  it("borra su segundo factor, anula sus códigos, cierra sus sesiones y abre 30 min para enrolar de nuevo", async () => {
    const t = reloj(14);
    const f = await familiarEnrolado(t);
    const r = await reiniciarTotpFamiliar(db, { email: f.email, ahora: t(10) });
    expect(r).toEqual({ usuarioId: f.id });
    expect(await fila(f.email)).toMatchObject({ totpSecreto: null, totpActivadoEn: null, totpUltimoPaso: null, presesionHash: null, sesionVersion: f.sesionVersion + 1 });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: f.id, usadoEn: null, anuladoEn: null } })).toBe(0);
    expect(await sesionDe(f, t(11))).toBeNull();
    expect(await db.intentoIngreso.count({ where: { usuarioId: f.id, resultado: "TOTP_REINICIADO" } })).toBe(1);
    expect(await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(12) })).toMatchObject({ ok: true, paso: "enrolar" });
  });

  it("con códigos de recuperación ya usados: anula los vigentes y deja los usados como estaban", async () => {
    const t = reloj(16);
    const f = await familiarEnrolado(t);
    const paso = await ingresar(db, { email: f.email, clave: CLAVE, ip: ipNueva(), ahora: t(4) });
    if (!paso.ok) throw new Error("debía pasar la clave");
    const usado = await verificarSegundoPaso(db, { presesion: { sub: f.id, sesionVersion: paso.sesionVersion, jti: paso.jti }, codigo: f.codigos[0] ?? "", ip: ipNueva(), ahora: t(5) });
    expect(usado).toMatchObject({ ok: true, via: "RECUPERACION", restantes: 9 });
    await reiniciarTotpFamiliar(db, { email: f.email, ahora: t(6) });
    const codigos = await db.codigoRecuperacion.findMany({ where: { usuarioId: f.id } });
    expect(codigos.filter((c) => c.usadoEn !== null && c.anuladoEn === null)).toHaveLength(1);
    expect(codigos.filter((c) => c.anuladoEn !== null)).toHaveLength(9);
  });

  it("no toca al dueño, a un correo que no existe ni a un revocado; y el reinicio del dueño sigue sin tocar al familiar", async () => {
    const dueno = correo();
    await db.usuario.create({ data: { email: dueno, rol: "DUENO" } });
    expect(await codigo(reiniciarTotpFamiliar(db, { email: dueno, ahora: reloj(15)() }))).toBe("ES_DEL_DUENO");
    expect(await codigo(reiniciarTotpFamiliar(db, { email: correo(), ahora: reloj(15)() }))).toBe("NO_EXISTE");
    const revocado = correo();
    await emitirAccesoFamiliar(db, { email: revocado, ahora: reloj(15)() });
    await revocarFamiliar(db, { email: revocado, ahora: reloj(15)(1) });
    expect(await codigo(reiniciarTotpFamiliar(db, { email: revocado, ahora: reloj(15)(2) }))).toBe("REVOCADO");
    const familiar = correo();
    await emitirAccesoFamiliar(db, { email: familiar, ahora: reloj(15)() });
    expect(await codigo(reiniciarTotp(db, { email: familiar, ahora: reloj(15)(3) }))).toBe("ROL_DISTINTO");
  });
});
