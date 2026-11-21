// Enrolamiento del TOTP contra la base de PRUEBAS: la página lee el secreto pendiente sin escribir; la
// confirmación con un código válido lo activa, sube la versión de sesión (mata las sesiones de solo clave),
// crea 10 códigos de recuperación y los devuelve una vez. Solo dentro de la ventana de 30 min (D1) y con la
// pre-sesión vigente. Los fallos cuentan para el bloqueo (D5). Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashClave } from "@/auth/clave";
import { confirmarEnrolamiento, datosDeEnrolamiento } from "@/auth/enrolamiento";
import { ingresar } from "@/auth/ingreso";
import type { DatosPresesion } from "@/auth/presesion";
import { generarJti } from "@/auth/presesion";
import { hashCodigoRecuperacion, normalizarCodigoRecuperacion } from "@/auth/recuperacion";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { validarSesion } from "@/auth/sesion";
import { firmarToken } from "@/auth/token";
import { codificarBase32, hotp, pasoDe } from "@/auth/totp";
import { codigoMalo } from "./auth-totp-ayudas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-enrolar-008";
const CLAVE_SESION = new TextEncoder().encode("k".repeat(32));
const MIN = 60;
let hash = "";
let n = 0;
/** Una /64 de documentación (RFC 3849) por intento y por corrida: no la comparte ninguna otra prueba. */
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:d${(n += 1).toString(16)}::1`;
const reloj = (horas: number) => (segundos = 0) => new Date(Date.UTC(2033, 0, 1) + horas * 3_600_000 + segundos * 1000);

interface Preparada {
  readonly id: string;
  readonly email: string;
  readonly pre: DatosPresesion;
  readonly secreto: Buffer;
}

/** Una cuenta recién salida del enlace (CLAVE_DEFINIDA `hace` segundos) que acaba de pasar la clave. */
async function preparada(t: (s?: number) => Date, hace = -MIN): Promise<Preparada> {
  const email = `enrolar-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const u = await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } });
  await db.intentoIngreso.create({ data: { usuarioId: u.id, resultado: "CLAVE_DEFINIDA", ocurridoEn: t(hace) } });
  const r = await ingresar(db, { email, clave: CLAVE, ip: ipNueva(), ahora: t() });
  if (!r.ok || r.paso !== "enrolar") throw new Error("debía quedar para enrolar");
  const fila = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
  return { id: u.id, email, pre: { sub: u.id, sesionVersion: r.sesionVersion, jti: r.jti }, secreto: descifrarSecretoTotp(fila.totpSecreto, u.id) };
}

const codigoDe = (secreto: Buffer, ahora: Date) => hotp(secreto, pasoDe(ahora.getTime()));
const confirmar = (p: Preparada, codigo: string, ahora: Date) => confirmarEnrolamiento(db, { presesion: p.pre, codigo, ip: ipNueva(), ahora });

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave(CLAVE);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("datosDeEnrolamiento (lo que lee la página)", () => {
  it("con la pre-sesión vigente da el correo, el base32 y el otpauth, sin escribir nada", async () => {
    const t = reloj(1);
    const p = await preparada(t);
    const antes = [await db.usuario.findUniqueOrThrow({ where: { id: p.id } }), await db.intentoIngreso.count({ where: { usuarioId: p.id } })];
    const d = await datosDeEnrolamiento(db, p.pre, t(10));
    const base32 = codificarBase32(p.secreto).replace(/=+$/, "");
    expect(d).toEqual({
      estado: "LISTO",
      email: p.email,
      secreto: base32,
      uri: `otpauth://totp/Inversiones:${encodeURIComponent(p.email)}?secret=${base32}&issuer=Inversiones&algorithm=SHA1&digits=6&period=30`,
    });
    expect([await db.usuario.findUniqueOrThrow({ where: { id: p.id } }), await db.intentoIngreso.count({ where: { usuarioId: p.id } })]).toEqual(antes);
  });

  it("con una pre-sesión reemplazada o de otra versión dice VENCIDA", async () => {
    const t = reloj(2);
    const p = await preparada(t);
    expect(await datosDeEnrolamiento(db, { ...p.pre, jti: generarJti() }, t(1))).toEqual({ estado: "VENCIDA" });
    expect(await datosDeEnrolamiento(db, { ...p.pre, sesionVersion: 2 }, t(1))).toEqual({ estado: "VENCIDA" });
  });

  it("fuera de la ventana de 30 min dice FUERA_DE_PLAZO", async () => {
    const t = reloj(3);
    const p = await preparada(t, -29 * MIN);
    expect(await datosDeEnrolamiento(db, p.pre, t(2 * MIN))).toEqual({ estado: "FUERA_DE_PLAZO" });
  });

  it("con el TOTP ya activo dice ACTIVO", async () => {
    const t = reloj(4);
    const p = await preparada(t);
    await db.usuario.update({ where: { id: p.id }, data: { totpActivadoEn: t(), totpUltimoPaso: 0 } });
    expect(await datosDeEnrolamiento(db, p.pre, t(1))).toEqual({ estado: "ACTIVO" });
  });
});

describe("confirmarEnrolamiento", () => {
  it("con el código correcto activa el TOTP, sube la versión, crea 10 códigos y los devuelve una vez", async () => {
    const t = reloj(10);
    const p = await preparada(t);
    const r = await confirmar(p, codigoDe(p.secreto, t(5)), t(5));
    expect(r).toMatchObject({ ok: true, usuarioId: p.id, sesionVersion: 2 });
    if (!r.ok) throw new Error("debía enrolar");
    const fila = await db.usuario.findUniqueOrThrow({ where: { id: p.id } });
    expect(fila).toMatchObject({ totpActivadoEn: t(5), totpUltimoPaso: pasoDe(t(5).getTime()), sesionVersion: 2, presesionHash: null });
    expect(r.codigos).toHaveLength(10);
    const vigentes = await db.codigoRecuperacion.findMany({ where: { usuarioId: p.id, usadoEn: null, anuladoEn: null }, select: { codigoHash: true } });
    expect(vigentes.map((v) => v.codigoHash).sort()).toEqual(r.codigos.map((c) => hashCodigoRecuperacion(normalizarCodigoRecuperacion(c) ?? "")).sort());
    expect(await db.intentoIngreso.count({ where: { usuarioId: p.id, resultado: "TOTP_ENROLADO" } })).toBe(1);
  });

  it("una sesión de solo clave de antes del enrolamiento deja de valer; la nueva sí vale", async () => {
    const t = reloj(11);
    const p = await preparada(t);
    const vieja = await firmarToken({ sub: p.id, sesionVersion: 1 }, CLAVE_SESION, Date.now());
    const r = await confirmar(p, codigoDe(p.secreto, t(1)), t(1));
    if (!r.ok) throw new Error("debía enrolar");
    expect(await validarSesion(db, vieja, CLAVE_SESION, Date.now())).toBeNull();
    const nueva = await firmarToken({ sub: p.id, sesionVersion: r.sesionVersion }, CLAVE_SESION, Date.now());
    expect(await validarSesion(db, nueva, CLAVE_SESION, Date.now())).toMatchObject({ id: p.id });
  });

  it("carrera: dos confirmaciones a la vez con el mismo código, enrola una sola", async () => {
    const t = reloj(12);
    const p = await preparada(t);
    const codigo = codigoDe(p.secreto, t(1));
    const rs = await Promise.all([1, 2].map(() => confirmar(p, codigo, t(1))));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: p.id } })).toBe(10);
  });

  it("ya enrolado, la misma pre-sesión no vuelve a enrolar (ni crea otros códigos)", async () => {
    const t = reloj(13);
    const p = await preparada(t);
    expect(await confirmar(p, codigoDe(p.secreto, t(1)), t(1))).toMatchObject({ ok: true });
    expect(await confirmar(p, hotp(p.secreto, pasoDe(t(1).getTime()) + 1), t(2))).toEqual({ ok: false, motivo: "PRESESION_INVALIDA" });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: p.id } })).toBe(10);
  });

  it("un código errado no activa nada y cuenta como fallo; 5 bloquean la cuenta", async () => {
    const t = reloj(14);
    const p = await preparada(t);
    for (let k = 0; k < 5; k += 1) expect(await confirmar(p, codigoMalo(t(k + 1), p.secreto), t(k + 1))).toEqual({ ok: false, motivo: "FALLO" });
    const fila = await db.usuario.findUniqueOrThrow({ where: { id: p.id } });
    expect(fila.totpActivadoEn).toBeNull();
    expect(fila.bloqueadoHasta).not.toBeNull();
    expect(await confirmar(p, codigoDe(p.secreto, t(10)), t(10))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await db.intentoIngreso.count({ where: { usuarioId: p.id, resultado: "TOTP_INCORRECTO" } })).toBe(5);
  });

  it("fuera de la ventana de 30 min no enrola, aunque el código sea correcto", async () => {
    const t = reloj(15);
    const p = await preparada(t, -29 * MIN);
    expect(await confirmar(p, codigoDe(p.secreto, t(2 * MIN)), t(2 * MIN))).toEqual({ ok: false, motivo: "FUERA_DE_PLAZO" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: p.id } })).totpActivadoEn).toBeNull();
  });

  it("con la pre-sesión reemplazada por otro ingreso no enrola", async () => {
    const t = reloj(16);
    const p = await preparada(t);
    await ingresar(db, { email: p.email, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
    expect(await confirmar(p, codigoDe(p.secreto, t(2)), t(2))).toEqual({ ok: false, motivo: "PRESESION_INVALIDA" });
  });

  it("volver a pasar la clave en la misma ventana reusa el secreto: el QR ya escaneado sigue sirviendo", async () => {
    const t = reloj(17);
    const p = await preparada(t);
    const r = await ingresar(db, { email: p.email, clave: CLAVE, ip: ipNueva(), ahora: t(1) });
    if (!r.ok) throw new Error("debía entrar");
    const nueva = { ...p, pre: { sub: p.id, sesionVersion: r.sesionVersion, jti: r.jti } };
    expect(await confirmar(nueva, codigoDe(p.secreto, t(2)), t(2))).toMatchObject({ ok: true });
  });

  it("una ventana nueva reemplaza el secreto: el de antes ya no enrola", async () => {
    const t = reloj(18);
    const p = await preparada(t);
    await db.intentoIngreso.create({ data: { usuarioId: p.id, resultado: "CLAVE_DEFINIDA", ocurridoEn: t(1) } });
    const r = await ingresar(db, { email: p.email, clave: CLAVE, ip: ipNueva(), ahora: t(2) });
    if (!r.ok) throw new Error("debía entrar");
    const nueva = { ...p, pre: { sub: p.id, sesionVersion: r.sesionVersion, jti: r.jti } };
    expect(await confirmar(nueva, codigoDe(p.secreto, t(3)), t(3))).toEqual({ ok: false, motivo: "FALLO" });
  });

  it("el código de 6 dígitos con espacios también enrola", async () => {
    const t = reloj(19);
    const p = await preparada(t);
    const c = codigoDe(p.secreto, t(1));
    expect(await confirmar(p, `${c.slice(0, 3)} ${c.slice(3)}`, t(1))).toMatchObject({ ok: true });
  });
});
