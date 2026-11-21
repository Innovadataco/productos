// POST /api/sesion/totp y POST /api/sesion/totp/enrolar, llamados como Next los llama, contra la base de
// PRUEBAS: la pre-sesión va SOLO en `__Host-presesion` (y la sesión nunca la reemplaza), el éxito da la
// sesión y borra la pre-sesión en la misma respuesta, los fallos dicen siempre lo mismo y todo va sin caché.
// Datos inventados: correos `@ejemplo.invalid`, IP de documentación, secreto del apéndice de RFC 6238.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashClave } from "@/auth/clave";
import { firmarPresesion, generarJti, hashJti } from "@/auth/presesion";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { firmarToken, verificarToken } from "@/auth/token";
import { hotp, pasoDe } from "@/auth/totp";
import { activarTotp, codigoEn, codigoMalo } from "./auth-totp-ayudas";

// Secreto inventado solo para esta prueba (el proceso de vitest no lee ningún .env de producción).
process.env.AUTH_SECRET = "secreto-ficticio-de-integracion-totp-0123456789";
const CLAVE_SESION = new TextEncoder().encode(process.env.AUTH_SECRET);

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-api-totp-008";
const ORIGEN = "http://127.0.0.1:5008";
const INCORRECTO = "Código incorrecto";
let hash = "";
let n = 0;
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:f${(n += 1).toString(16)}::1`;

type Ruta = (r: Request) => Promise<Response>;
let totp: Ruta;
let enrolar: Ruta;

function pedido(ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { origin: ORIGEN, "content-type": "application/json", "cf-connecting-ip": ipNueva(), ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

/** Una pre-sesión nueva de la cuenta (firmada y con su hash en la base), como la deja el paso de la clave. */
async function nuevaPresesion(id: string): Promise<{ id: string; cookie: string; token: string }> {
  const jti = generarJti();
  const { sesionVersion } = await db.usuario.update({ where: { id }, data: { presesionHash: hashJti(jti) } });
  const token = await firmarPresesion({ sub: id, sesionVersion, jti }, CLAVE_SESION, Date.now());
  return { id, cookie: `__Host-presesion=${token}`, token };
}

async function conPresesion(datos: { totp: boolean; ventana?: boolean }): Promise<{ id: string; cookie: string; token: string }> {
  const u = await db.usuario.create({ data: { email: `api-totp-${corrida}-${(n += 1)}@ejemplo.invalid`, rol: "DUENO", claveHash: hash } });
  if (datos.totp) await activarTotp(db, u.id, new Date(), pasoDe(Date.now()) - 10);
  if (datos.ventana) await db.intentoIngreso.create({ data: { usuarioId: u.id, resultado: "CLAVE_DEFINIDA", ocurridoEn: new Date() } });
  return nuevaPresesion(u.id);
}

const tokenDe = (r: Response, nombre: string) =>
  r.headers
    .getSetCookie()
    .map((c) => new RegExp(`^${nombre}=([^;]*)`).exec(c)?.[1])
    .find((v) => v !== undefined);

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave(CLAVE);
  totp = (await import("@/app/api/sesion/totp/route")).POST;
  enrolar = (await import("@/app/api/sesion/totp/enrolar/route")).POST;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("POST /api/sesion/totp", () => {
  it("con el código correcto da la sesión y borra la pre-sesión, sin caché", async () => {
    const c = await conPresesion({ totp: true });
    const r = await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, { cookie: c.cookie }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ ok: true, restantes: null });
    const cookies = r.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toMatch(/^__Host-sesion=[A-Za-z0-9._-]+; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
    expect(cookies[1]).toMatch(/^__Host-presesion=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
    expect(await verificarToken(tokenDe(r, "__Host-sesion") ?? "", CLAVE_SESION, Date.now())).toEqual({ sub: c.id, sesionVersion: 1 });
  });

  it("con un código errado responde 401 con el mensaje genérico y sin sesión", async () => {
    const c = await conPresesion({ totp: true });
    const r = await totp(pedido("/api/sesion/totp", { codigo: codigoMalo(new Date()) }, { cookie: c.cookie }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: INCORRECTO });
    expect(tokenDe(r, "__Host-sesion")).toBeUndefined();
  });

  it("un código repetido y uno de recuperación inválido dicen exactamente lo mismo", async () => {
    const c = await conPresesion({ totp: true });
    const codigo = codigoEn(new Date());
    expect((await totp(pedido("/api/sesion/totp", { codigo }, { cookie: c.cookie }))).status).toBe(200);
    const otra = await nuevaPresesion(c.id);
    const repetido = await totp(pedido("/api/sesion/totp", { codigo }, { cookie: otra.cookie }));
    const recuperacion = await totp(pedido("/api/sesion/totp", { codigo: "ABCD-EFGH-JKMN-PQRS" }, { cookie: otra.cookie }));
    for (const x of [repetido, recuperacion]) {
      expect(x.status).toBe(401);
      expect(await x.json()).toEqual({ error: INCORRECTO });
    }
    const vistos = await db.intentoIngreso.findMany({ where: { usuarioId: c.id }, orderBy: { ocurridoEn: "asc" }, select: { resultado: true } });
    expect(vistos.map((v) => v.resultado)).toEqual(["TOTP_EXITO", "TOTP_REPETIDO", "RECUPERACION_INVALIDA"]);
  });

  it.each([
    ["sin pre-sesión", () => ""],
    ["con la pre-sesión en la cookie de la sesión", (c: { token: string }) => `__Host-sesion=${c.token}`],
    ["con una pre-sesión de otro secreto", () => "__Host-presesion=eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa"],
  ])("%s responde 401, pide volver a ingresar y borra la pre-sesión", async (_caso, cookie) => {
    const c = await conPresesion({ totp: true });
    const r = await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, { cookie: cookie(c) }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "La verificación venció. Ingrese de nuevo.", reingresar: true });
    expect(r.headers.getSetCookie().some((x) => x.startsWith("__Host-presesion=;"))).toBe(true);
    expect(tokenDe(r, "__Host-sesion")).toBeUndefined();
  });

  it("una sesión completa no sirve como pre-sesión", async () => {
    const c = await conPresesion({ totp: true });
    const sesion = await firmarToken({ sub: c.id, sesionVersion: 1 }, CLAVE_SESION, Date.now());
    const r = await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, { cookie: `__Host-presesion=${sesion}` }));
    expect(r.status).toBe(401);
    expect((await r.json()).reingresar).toBe(true);
  });

  it("desde otro sitio responde 403; un cuerpo con campos de más, 400", async () => {
    const c = await conPresesion({ totp: true });
    const codigo = codigoEn(new Date());
    expect((await totp(pedido("/api/sesion/totp", { codigo }, { cookie: c.cookie, origin: "https://atacante.example" }))).status).toBe(403);
    expect((await totp(pedido("/api/sesion/totp", { codigo, email: "x" }, { cookie: c.cookie }))).status).toBe(400);
    expect((await totp(pedido("/api/sesion/totp", "codigo=1", { cookie: c.cookie }))).status).toBe(400);
  });
});

describe("POST /api/sesion/totp/enrolar", () => {
  async function pendiente(): Promise<{ id: string; cookie: string; secreto: Buffer }> {
    const c = await conPresesion({ totp: false, ventana: true });
    const { cifrarSecretoTotp } = await import("@/auth/secreto-totp");
    const secreto = Buffer.from("enrolar-api-ficticio", "ascii");
    await db.usuario.update({ where: { id: c.id }, data: { totpSecreto: cifrarSecretoTotp(secreto, c.id) } });
    expect(descifrarSecretoTotp((await db.usuario.findUniqueOrThrow({ where: { id: c.id } })).totpSecreto, c.id).equals(secreto)).toBe(true);
    return { ...c, secreto };
  }

  it("con el código correcto da la sesión (versión nueva), borra la pre-sesión y devuelve los 10 códigos sin caché", async () => {
    const p = await pendiente();
    const r = await enrolar(pedido("/api/sesion/totp/enrolar", { codigo: hotp(p.secreto, pasoDe(Date.now())) }, { cookie: p.cookie }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const cuerpo = (await r.json()) as { ok: boolean; codigos: string[] };
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.codigos).toHaveLength(10);
    expect(await verificarToken(tokenDe(r, "__Host-sesion") ?? "", CLAVE_SESION, Date.now())).toEqual({ sub: p.id, sesionVersion: 2 });
    expect(r.headers.getSetCookie().some((x) => x.startsWith("__Host-presesion=;"))).toBe(true);
  });

  it("con un código errado responde 401 genérico", async () => {
    const p = await pendiente();
    const r = await enrolar(pedido("/api/sesion/totp/enrolar", { codigo: codigoMalo(new Date(), p.secreto) }, { cookie: p.cookie }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: INCORRECTO });
  });

  it("fuera de la ventana de 30 min responde 403 y dice cómo volver a abrirla", async () => {
    const c = await conPresesion({ totp: false });
    const r = await enrolar(pedido("/api/sesion/totp/enrolar", { codigo: "123456" }, { cookie: c.cookie }));
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/crear-acceso-inicial.*--reiniciar-totp/);
  });

  it("sin pre-sesión responde 401 y pide volver a ingresar", async () => {
    const r = await enrolar(pedido("/api/sesion/totp/enrolar", { codigo: "123456" }));
    expect(r.status).toBe(401);
    expect((await r.json()).reingresar).toBe(true);
  });
});
