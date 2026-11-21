// Regenerar los códigos de recuperación (/totp/codigos) contra la base de PRUEBAS: exige la sesión completa
// y además un código TOTP vigente (con antireplay; los fallos cuentan para el bloqueo). Anula todos los
// vigentes y crea 10 nuevos, que se devuelven una vez. Datos inventados (secreto del apéndice de RFC 6238).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashClave } from "@/auth/clave";
import { crearCodigosRecuperacion } from "@/auth/codigos";
import { generarJti, hashJti } from "@/auth/presesion";
import { regenerarCodigos } from "@/auth/regenerar";
import { verificarSegundoPaso } from "@/auth/segundo-paso";
import { firmarToken } from "@/auth/token";
import { pasoDe } from "@/auth/totp";
import { activarTotp, codigoEn, codigoMalo } from "./auth-totp-ayudas";

process.env.AUTH_SECRET = "secreto-ficticio-de-integracion-codigos-0123456789";
const CLAVE_SESION = new TextEncoder().encode(process.env.AUTH_SECRET);

const db = new PrismaClient();
const corrida = Date.now().toString(36);
let hash = "";
let n = 0;
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:c${(n += 1).toString(16)}::1`;
const reloj = (horas: number) => (segundos = 0) => new Date(Date.UTC(2034, 0, 1) + horas * 3_600_000 + segundos * 1000);

async function cuenta(ahora: Date): Promise<{ id: string; viejos: readonly string[] }> {
  const u = await db.usuario.create({ data: { email: `codigos-${corrida}-${(n += 1)}@ejemplo.invalid`, rol: "DUENO", claveHash: hash } });
  await activarTotp(db, u.id, ahora, pasoDe(ahora.getTime()) - 10);
  const viejos = await db.$transaction((tx) => crearCodigosRecuperacion(tx, u.id, ahora));
  return { id: u.id, viejos };
}

const regenerar = (usuarioId: string, codigo: string, ahora: Date) => regenerarCodigos(db, { usuarioId, codigo, ip: ipNueva(), ahora });

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave("clave-ficticia-codigos-008");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("regenerarCodigos", () => {
  it("con un código TOTP vigente anula los 10 anteriores, crea 10 nuevos y guarda el paso", async () => {
    const t = reloj(1);
    const u = await cuenta(t());
    const r = await regenerar(u.id, codigoEn(t(5)), t(5));
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) throw new Error("debía regenerar");
    expect(r.codigos).toHaveLength(10);
    expect(r.codigos.some((c) => u.viejos.includes(c))).toBe(false);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, anuladoEn: { not: null } } })).toBe(10);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: null, anuladoEn: null } })).toBe(10);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).totpUltimoPaso).toBe(pasoDe(t(5).getTime()));
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "CODIGOS_REGENERADOS" } })).toBe(1);
  });

  it("después, un código anterior ya no sirve en el segundo paso y uno nuevo sí", async () => {
    const t = reloj(2);
    const u = await cuenta(t());
    const r = await regenerar(u.id, codigoEn(t()), t());
    if (!r.ok) throw new Error("debía regenerar");
    const entrar = async (codigo: string, s: number) => {
      const jti = generarJti();
      await db.usuario.update({ where: { id: u.id }, data: { presesionHash: hashJti(jti) } });
      return verificarSegundoPaso(db, { presesion: { sub: u.id, sesionVersion: 1, jti }, codigo, ip: ipNueva(), ahora: t(s) });
    };
    expect(await entrar(u.viejos[0] ?? "", 1)).toEqual({ ok: false, motivo: "FALLO" });
    expect(await entrar(r.codigos[0] ?? "", 2)).toMatchObject({ ok: true, via: "RECUPERACION", restantes: 9 });
  });

  it("un código repetido o errado no cambia nada y queda registrado", async () => {
    const t = reloj(3);
    const u = await cuenta(t());
    expect(await regenerar(u.id, codigoEn(t()), t())).toMatchObject({ ok: true });
    expect(await regenerar(u.id, codigoEn(t()), t(1))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await regenerar(u.id, codigoMalo(t(2)), t(2))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: null, anuladoEn: null } })).toBe(10);
    const resultados = await db.intentoIngreso.findMany({ where: { usuarioId: u.id }, orderBy: { ocurridoEn: "asc" }, select: { resultado: true } });
    expect(resultados.map((x) => x.resultado)).toEqual(["CODIGOS_REGENERADOS", "TOTP_REPETIDO", "TOTP_INCORRECTO"]);
  });

  it("un código de recuperación no sirve para regenerar (solo el de la app)", async () => {
    const t = reloj(4);
    const u = await cuenta(t());
    expect(await regenerar(u.id, u.viejos[0] ?? "", t())).toEqual({ ok: false, motivo: "FALLO" });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: null, anuladoEn: null } })).toBe(10);
  });

  it("5 fallos bloquean la cuenta, y bloqueada no regenera ni con el código correcto", async () => {
    const t = reloj(5);
    const u = await cuenta(t());
    for (let k = 0; k < 5; k += 1) await regenerar(u.id, codigoMalo(t(k)), t(k));
    expect((await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).bloqueadoHasta).not.toBeNull();
    expect(await regenerar(u.id, codigoEn(t(10)), t(10))).toEqual({ ok: false, motivo: "FALLO" });
  });

  it("anular o gastar con un reloj anterior a la creación no rompe el CHECK de fechas (carrera de relojes)", async () => {
    const t = reloj(7);
    const u = await cuenta(t(10));
    const { anularCodigos, gastarCodigo } = await import("@/auth/codigos");
    const { normalizarCodigoRecuperacion } = await import("@/auth/recuperacion");
    await expect(db.$transaction((tx) => gastarCodigo(tx, u.id, normalizarCodigoRecuperacion(u.viejos[0] ?? "") ?? "", t()))).resolves.toBe(9);
    await expect(db.$transaction((tx) => anularCodigos(tx, u.id, t()))).resolves.toBeUndefined();
    const filas = await db.codigoRecuperacion.findMany({ where: { usuarioId: u.id } });
    for (const f of filas) expect((f.usadoEn ?? f.anuladoEn)?.getTime()).toBe(t(10).getTime());
  });

  it("carrera: dos regeneraciones a la vez con el mismo código, gana una", async () => {
    const t = reloj(6);
    const u = await cuenta(t());
    const rs = await Promise.all([1, 2].map(() => regenerar(u.id, codigoEn(t()), t())));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: null, anuladoEn: null } })).toBe(10);
  });
});

describe("POST /api/sesion/totp/codigos", () => {
  type Ruta = (r: Request) => Promise<Response>;
  let ruta: Ruta;
  const ORIGEN = "http://127.0.0.1:5008";

  beforeAll(async () => {
    ruta = (await import("@/app/api/sesion/totp/codigos/route")).POST;
  });

  const pedido = (cuerpo: unknown, cabeceras: Record<string, string>) =>
    new Request(`${ORIGEN}/api/sesion/totp/codigos`, {
      method: "POST",
      headers: { origin: ORIGEN, "content-type": "application/json", "cf-connecting-ip": ipNueva(), ...cabeceras },
      body: JSON.stringify(cuerpo),
    });

  it("con sesión y un código vigente responde 200 con los 10 códigos, sin caché", async () => {
    const u = await cuenta(new Date());
    const cookie = `__Host-sesion=${await firmarToken({ sub: u.id, sesionVersion: 1 }, CLAVE_SESION, Date.now())}`;
    const r = await ruta(pedido({ codigo: codigoEn(new Date()) }, { cookie }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(((await r.json()) as { codigos: string[] }).codigos).toHaveLength(10);
  });

  it("sin sesión responde 401; con la pre-sesión, también", async () => {
    expect((await ruta(pedido({ codigo: "123456" }, {}))).status).toBe(401);
    expect((await ruta(pedido({ codigo: "123456" }, { cookie: "__Host-presesion=x.y.z" }))).status).toBe(401);
  });

  it("con un código errado responde 401 genérico; desde otro sitio, 403", async () => {
    const u = await cuenta(new Date());
    const cookie = `__Host-sesion=${await firmarToken({ sub: u.id, sesionVersion: 1 }, CLAVE_SESION, Date.now())}`;
    const malo = await ruta(pedido({ codigo: codigoMalo(new Date()) }, { cookie }));
    expect(malo.status).toBe(401);
    expect(await malo.json()).toEqual({ error: "Código incorrecto" });
    expect((await ruta(pedido({ codigo: codigoEn(new Date()) }, { cookie, origin: "https://atacante.example" }))).status).toBe(403);
  });
});
