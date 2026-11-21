// `crear-acceso-inicial --reiniciar-totp` contra la base de PRUEBAS (recuperación total: perdió el teléfono
// Y los códigos). En una transacción: borra el secreto, la activación, el último paso y la pre-sesión, anula
// los códigos, limpia el bloqueo, sube la versión (cierra todas las sesiones) y registra TOTP_REINICIADO,
// que abre la ventana de 30 min para enrolar de nuevo al entrar. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorAcceso } from "@/auth/acceso";
import { ejecutar } from "@/auth/acceso-cli";
import { hashClave } from "@/auth/clave";
import { crearCodigosRecuperacion } from "@/auth/codigos";
import { confirmarEnrolamiento } from "@/auth/enrolamiento";
import { ingresar } from "@/auth/ingreso";
import { reiniciarTotp } from "@/auth/reinicio-totp";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { validarSesion } from "@/auth/sesion";
import { firmarToken } from "@/auth/token";
import { hotp, pasoDe } from "@/auth/totp";
import { activarTotp } from "./auth-totp-ayudas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-reinicio-008";
const CLAVE_SESION = new TextEncoder().encode("k".repeat(32));
let hash = "";
let n = 0;
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:e${(n += 1).toString(16)}::1`;

class Salida extends Writable {
  texto = "";
  override _write(trozo: Buffer, _c: BufferEncoding, listo: () => void): void {
    this.texto += trozo.toString("utf8");
    listo();
  }
}

async function enrolada(): Promise<{ id: string; email: string }> {
  const email = `reinicio-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const u = await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } });
  const ahora = new Date();
  await activarTotp(db, u.id, ahora, pasoDe(ahora.getTime()));
  await db.$transaction((tx) => crearCodigosRecuperacion(tx, u.id, ahora));
  await db.usuario.update({ where: { id: u.id }, data: { bloqueadoHasta: new Date(Date.now() + 3_600_000), presesionHash: "a".repeat(64) } });
  return { id: u.id, email };
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave(CLAVE);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("reiniciarTotp", () => {
  it("deja la cuenta sin TOTP, sin códigos vigentes, sin bloqueo ni pre-sesión, con la versión subida", async () => {
    const u = await enrolada();
    const sesion = await firmarToken({ sub: u.id, sesionVersion: 1 }, CLAVE_SESION, Date.now());
    expect(await validarSesion(db, sesion, CLAVE_SESION, Date.now())).not.toBeNull();
    await reiniciarTotp(db, { email: u.email, ahora: new Date() });
    const fila = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(fila).toMatchObject({ totpSecreto: null, totpActivadoEn: null, totpUltimoPaso: null, presesionHash: null, bloqueadoHasta: null, sesionVersion: 2 });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: null, anuladoEn: null } })).toBe(0);
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "TOTP_REINICIADO", ip: null } })).toBe(1);
    expect(await validarSesion(db, sesion, CLAVE_SESION, Date.now())).toBeNull();
  });

  it("después, al entrar con la clave, toca enrolar de nuevo y el enrolamiento funciona", async () => {
    const u = await enrolada();
    await reiniciarTotp(db, { email: u.email, ahora: new Date() });
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: new Date() });
    expect(r).toMatchObject({ ok: true, paso: "enrolar" });
    if (!r.ok) throw new Error("debía entrar");
    const secreto = descifrarSecretoTotp((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).totpSecreto, u.id);
    const ahora = new Date();
    const c = await confirmarEnrolamiento(db, {
      presesion: { sub: u.id, sesionVersion: r.sesionVersion, jti: r.jti },
      codigo: hotp(secreto, pasoDe(ahora.getTime())),
      ip: ipNueva(),
      ahora,
    });
    expect(c).toMatchObject({ ok: true, sesionVersion: 3 });
  });

  it("se puede correr dos veces sin error", async () => {
    const u = await enrolada();
    await reiniciarTotp(db, { email: u.email, ahora: new Date() });
    await expect(reiniciarTotp(db, { email: u.email, ahora: new Date() })).resolves.toMatchObject({ usuarioId: u.id });
  });

  it("no toca una cuenta que no existe ni una que no es DUENO", async () => {
    await expect(reiniciarTotp(db, { email: `nadie-${corrida}@ejemplo.invalid`, ahora: new Date() })).rejects.toThrow(ErrorAcceso);
    const familia = await db.usuario.create({ data: { email: `familia-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } });
    await expect(reiniciarTotp(db, { email: familia.email, ahora: new Date() })).rejects.toThrow(/no es DUENO/);
  });

  it("en producción solo corre con el rol inv_dueno: con otro rol sale con 2 y no toca nada", async () => {
    const u = await enrolada();
    const consola = { salida: new Salida(), error: new Salida() };
    const env = { NODE_ENV: "production", APP_ORIGEN: "https://inversiones.innovadataco.com" };
    expect(await ejecutar(["--email", u.email, "--reiniciar-totp"], consola, db, env)).toBe(2);
    expect(consola.error.texto).toMatch(/inv_dueno/);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).totpActivadoEn).not.toBeNull();
  });

  it("el comando completo (ejecutar) reinicia y sale con 0", async () => {
    const u = await enrolada();
    const consola = { salida: new Salida(), error: new Salida() };
    expect(await ejecutar(["--email", u.email, "--reiniciar-totp"], consola, db, { NODE_ENV: "development" })).toBe(0);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).totpActivadoEn).toBeNull();
  });
});
