// Integración del ingreso (D-014) contra la base de PRUEBAS: resultado de cada caso, bloqueo de la
// cuenta (5 fallos en 15 min la bloquean 15 min), tope por IP (20 en 15 min) y carrera.
// Datos inventados: correos `@ejemplo.invalid`, IP de documentación (RFC 5737 y RFC 3849).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compararClave, hashClave } from "@/auth/clave";
import { ingresar } from "@/auth/ingreso";
import { BLOQUEO_MS } from "@/auth/limites";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
/** Un grupo IPv6 propio de la corrida (hexadecimal). */
const grupo6 = (Date.now() % 0xffff).toString(16);
/** Contraseñas inventadas para la prueba. */
const CLAVE = "clave-ficticia-ingreso-008";
const MALA = "clave-equivocada-ficticia";
let hash = "";
let n = 0;
/** Cada prueba usa su propia IP y su propio reloj: los conteos no se cruzan. */
const ipNueva = () => `203.0.113.${((n += 1) % 250) + 1}`;
const reloj = (horas: number) => (segundos = 0) => new Date(Date.UTC(2030, 0, 1) + horas * 3_600_000 + segundos * 1000);
const MIN = 60;

async function usuario(datos: { rol?: "DUENO" | "FAMILIA"; activo?: boolean; conClave?: boolean } = {}) {
  const email = `ingreso-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const u = await db.usuario.create({
    data: { email, rol: datos.rol ?? "DUENO", activo: datos.activo ?? true, claveHash: datos.conClave === false ? null : hash },
  });
  return { id: u.id, email };
}

const intentos = (usuarioId: string) => db.intentoIngreso.findMany({ where: { usuarioId }, orderBy: { ocurridoEn: "asc" } });

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave(CLAVE);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("resultado de un intento", () => {
  it("clave correcta: pasa el primer paso (pre-sesión y paso siguiente) y registra EXITO con su IP", async () => {
    const u = await usuario();
    const ip = ipNueva();
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip, ahora: reloj(1)() });
    expect(r).toEqual({ ok: true, usuarioId: u.id, sesionVersion: 1, jti: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), paso: "enrolar" });
    const [i] = await intentos(u.id);
    expect(i).toMatchObject({ resultado: "EXITO", ip });
  });

  it("un familiar activo con la clave correcta pasa el primer paso como el dueño (frente familia-lectura)", async () => {
    const u = await usuario({ rol: "FAMILIA" });
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: reloj(1)(30) });
    expect(r).toEqual({ ok: true, usuarioId: u.id, sesionVersion: 1, jti: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), paso: "enrolar" });
    expect((await intentos(u.id)).map((i) => i.resultado)).toEqual(["EXITO"]);
  });

  it("el correo no distingue mayúsculas", async () => {
    const u = await usuario();
    const r = await ingresar(db, { email: u.email.toUpperCase(), clave: CLAVE, ip: ipNueva(), ahora: reloj(2)() });
    expect(r.ok).toBe(true);
  });

  it.each([
    ["clave incorrecta", {}, MALA, "CLAVE_INCORRECTA"],
    ["cuenta sin clave", { conClave: false }, CLAVE, "SIN_CLAVE"],
    ["cuenta inactiva, aun con la clave correcta", { activo: false }, CLAVE, "CUENTA_INACTIVA"],
    ["familiar revocado (inactivo), aun con la clave correcta", { rol: "FAMILIA" as const, activo: false }, CLAVE, "CUENTA_INACTIVA"],
    ["familiar con la clave incorrecta", { rol: "FAMILIA" as const }, MALA, "CLAVE_INCORRECTA"],
  ])("%s: no entra y queda registrado", async (_caso, datos, clave, esperado) => {
    const u = await usuario(datos);
    const r = await ingresar(db, { email: u.email, clave, ip: ipNueva(), ahora: reloj(3)() });
    expect(r).toEqual({ ok: false, motivo: esperado });
    expect((await intentos(u.id)).map((i) => i.resultado)).toEqual([esperado]);
  });

  it("correo inexistente: no entra y el intento queda sin usuario (el correo no se guarda)", async () => {
    const ip = ipNueva();
    const r = await ingresar(db, { email: `nadie-${corrida}@ejemplo.invalid`, clave: CLAVE, ip, ahora: reloj(4)() });
    expect(r).toEqual({ ok: false, motivo: "USUARIO_INEXISTENTE" });
    const filas = await db.intentoIngreso.findMany({ where: { ip } });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ usuarioId: null, resultado: "USUARIO_INEXISTENTE" });
  });
});

describe("bloqueo de la cuenta", () => {
  it("5 fallos en 15 min la bloquean 15 min: la clave correcta no entra hasta que pasan", async () => {
    const u = await usuario();
    const t = reloj(10);
    for (let k = 0; k < 4; k += 1) {
      expect(await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(k * MIN) })).toEqual({ ok: false, motivo: "CLAVE_INCORRECTA" });
      expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta).toBeNull();
    }
    await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(4 * MIN) });
    const bloqueado = (await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta;
    expect(bloqueado?.getTime()).toBe(t(4 * MIN).getTime() + BLOQUEO_MS);

    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(5 * MIN) })).toEqual({ ok: false, motivo: "CUENTA_BLOQUEADA" });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(4 * MIN + 15 * MIN + 1) })).toMatchObject({ ok: true });
  });

  it("los intentos durante el bloqueo no lo alargan", async () => {
    const u = await usuario();
    const t = reloj(11);
    for (let k = 0; k < 5; k += 1) await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(k) });
    const antes = (await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta;
    expect(await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(10 * MIN) })).toEqual({ ok: false, motivo: "CUENTA_BLOQUEADA" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta).toEqual(antes);
  });

  it("después de un bloqueo se cuenta de cero: un fallo más no vuelve a bloquear", async () => {
    const u = await usuario();
    const t = reloj(12);
    for (let k = 0; k < 5; k += 1) await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(k) });
    const fin = 4 + 15 * MIN;
    expect(await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(fin + 1) })).toEqual({ ok: false, motivo: "CLAVE_INCORRECTA" });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(fin + 2) })).toMatchObject({ ok: true });
  });

  it("un ingreso correcto reinicia la cuenta de fallos", async () => {
    const u = await usuario();
    const t = reloj(13);
    for (let k = 0; k < 4; k += 1) await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(k) });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(10) })).toMatchObject({ ok: true });
    for (let k = 0; k < 4; k += 1) await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(20 + k) });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta).toBeNull();
  });

  it("los fallos de hace más de 15 min no cuentan", async () => {
    const u = await usuario();
    const t = reloj(14);
    for (let k = 0; k < 4; k += 1) await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(k) });
    await ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(16 * MIN) });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta).toBeNull();
  });

  it("carrera: 10 intentos fallidos en paralelo dan exactamente 5 CLAVE_INCORRECTA y luego bloqueo", async () => {
    const u = await usuario();
    const ip = ipNueva();
    const t = reloj(15);
    await Promise.all(Array.from({ length: 10 }, () => ingresar(db, { email: u.email, clave: MALA, ip, ahora: t() })));
    const resultados = (await intentos(u.id)).map((i) => i.resultado);
    expect(resultados.filter((r) => r === "CLAVE_INCORRECTA")).toHaveLength(5);
    expect(resultados.filter((r) => r === "CUENTA_BLOQUEADA")).toHaveLength(5);
  }, 30_000);
});

describe("carreras del ingreso", () => {
  it("si la clave cambia entre la comparación y el bloqueo de la fila, la comparación ya no vale", async () => {
    const u = await usuario();
    const otro = await hashClave("otra-clave-ficticia-cambio");
    const cambiaEnMedio = async (clave: string, hashLeido: string | null) => {
      const ok = await compararClave(clave, hashLeido);
      await db.usuario.update({ where: { id: u.id }, data: { claveHash: otro, sesionVersion: { increment: 1 } } });
      return ok;
    };
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: reloj(16)() }, cambiaEnMedio);
    expect(r).toEqual({ ok: false, motivo: "CLAVE_INCORRECTA" });
  });

  it("10 fallos desde IP distintas y con horas al azar dentro de la ventana dan exactamente 5 CLAVE_INCORRECTA", async () => {
    const u = await usuario();
    const t = reloj(17);
    await Promise.all(
      Array.from({ length: 10 }, () => ingresar(db, { email: u.email, clave: MALA, ip: ipNueva(), ahora: t(Math.floor(Math.random() * 10 * MIN)) })),
    );
    const resultados = (await intentos(u.id)).map((i) => i.resultado);
    expect(resultados.filter((r) => r === "CLAVE_INCORRECTA")).toHaveLength(5);
    expect(resultados.filter((r) => r === "CUENTA_BLOQUEADA")).toHaveLength(5);
  }, 30_000);
});

describe("tope por IP", () => {
  it("20 fallos de una IP en 15 min la cortan: ni la clave correcta entra y ese intento no se registra", async () => {
    const ip = ipNueva();
    const t = reloj(20);
    for (let k = 0; k < 20; k += 1) {
      await ingresar(db, { email: `nadie-${corrida}-${k}@ejemplo.invalid`, clave: MALA, ip, ahora: t(k) });
    }
    const u = await usuario();
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip, ahora: t(30) })).toEqual({ ok: false, motivo: "IP_LIMITADA" });
    expect(await intentos(u.id)).toHaveLength(0);
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(31) })).toMatchObject({ ok: true });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip, ahora: t(15 * MIN + 30) })).toMatchObject({ ok: true });
  }, 30_000);

  it("IPv6: veinte hosts de la misma /64 comparten el tope; otra /64 no", async () => {
    const t = reloj(21);
    for (let k = 0; k < 20; k += 1) {
      const ip = `2001:db8:${grupo6}:a::${k + 1}`;
      await ingresar(db, { email: `nadie6-${corrida}-${k}@ejemplo.invalid`, clave: MALA, ip, ahora: t(k) });
    }
    const u = await usuario();
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: `2001:db8:${grupo6}:a::ffff`, ahora: t(30) })).toEqual({
      ok: false,
      motivo: "IP_LIMITADA",
    });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: `2001:db8:${grupo6}:b::1`, ahora: t(31) })).toMatchObject({ ok: true });
  }, 30_000);

  it("sin IP (sin Cf-Connecting-IP) todos comparten el balde «sin IP»", async () => {
    const t = reloj(22);
    for (let k = 0; k < 20; k += 1) {
      await ingresar(db, { email: `nadie0-${corrida}-${k}@ejemplo.invalid`, clave: MALA, ip: null, ahora: t(k) });
    }
    const u = await usuario();
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: null, ahora: t(30) })).toEqual({ ok: false, motivo: "IP_LIMITADA" });
  }, 30_000);
});
