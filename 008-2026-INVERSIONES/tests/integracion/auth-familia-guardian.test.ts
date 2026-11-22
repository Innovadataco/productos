// El guardián del dueño (frente familia-lectura) contra la base de PRUEBAS: lo que escribe o administra es solo del dueño,
// y eso se decide en el SERVIDOR con el rol de la base (nunca con el del navegador ni con el JWT, que no lo lleva).
//  - exigirDuenoApi(pedido): sin sesión 401; familiar 403 JSON «Solo lectura», sin caché; dueño, su usuario.
//  - exigirDueno() (páginas): sin sesión a /ingresar; familiar, 404 (notFound); dueño, su usuario.
// next/headers y next/navigation se simulan (fuera de Next no existen); la sesión se revalida de verdad. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { firmarToken } from "@/auth/token";
import { activarTotp } from "./auth-totp-ayudas";

const cookie = vi.hoisted(() => ({ valor: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nombre: string) => (nombre === "__Host-sesion" && cookie.valor !== undefined ? { name: nombre, value: cookie.valor } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT ${destino}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { exigirDueno, exigirDuenoApi } from "@/auth/sesion";
import { MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const SECRETO = "k".repeat(32);
const CLAVE = new TextEncoder().encode(SECRETO);
const HASH = `$2b$12$${"g".repeat(53)}`;
let n = 0;

async function cuenta(rol: "DUENO" | "FAMILIA") {
  const u = await db.usuario.create({ data: { email: `guardian-${corrida}-${(n += 1)}@ejemplo.invalid`, rol, claveHash: HASH } });
  await activarTotp(db, u.id, new Date());
  return u;
}

const tokenDe = (id: string) => firmarToken({ sub: id, sesionVersion: 1 }, CLAVE, Date.now());
const pedido = (token?: string, metodo = "POST") =>
  new Request("http://127.0.0.1:5008/api/escritura-ficticia", { method: metodo, headers: token ? { cookie: `__Host-sesion=${token}` } : {} });

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  process.env.AUTH_SECRET = SECRETO;
});

beforeEach(() => {
  cookie.valor = undefined;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("exigirDuenoApi (API que escriben o administran)", () => {
  it("el dueño pasa, con su usuario de la base", async () => {
    const u = await cuenta("DUENO");
    expect(await exigirDuenoApi(pedido(await tokenDe(u.id)))).toEqual({ ok: true, usuario: { id: u.id, email: u.email, rol: "DUENO" } });
  });

  it("un familiar con sesión válida recibe 403 JSON «Solo lectura», sin caché", async () => {
    const u = await cuenta("FAMILIA");
    const r = await exigirDuenoApi(pedido(await tokenDe(u.id)));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.respuesta.status).toBe(403);
    expect(r.respuesta.headers.get("cache-control")).toBe("no-store");
    expect(await r.respuesta.json()).toEqual({ error: MENSAJE_SOLO_LECTURA });
  });

  it("sin sesión (o con la de un familiar revocado) es 401, como cualquier API protegida", async () => {
    const sin = await exigirDuenoApi(pedido());
    expect(sin.ok ? 0 : sin.respuesta.status).toBe(401);
    const u = await cuenta("FAMILIA");
    await db.usuario.update({ where: { id: u.id }, data: { activo: false } });
    const revocado = await exigirDuenoApi(pedido(await tokenDe(u.id)));
    expect(revocado.ok ? 0 : revocado.respuesta.status).toBe(401);
  });
});

describe("exigirDueno (páginas que escriben o administran)", () => {
  it("el dueño pasa, con su usuario", async () => {
    const u = await cuenta("DUENO");
    cookie.valor = await tokenDe(u.id);
    expect(await exigirDueno()).toEqual({ id: u.id, email: u.email, rol: "DUENO" });
  });

  it("un familiar recibe 404 (notFound): la página no existe para él", async () => {
    const u = await cuenta("FAMILIA");
    cookie.valor = await tokenDe(u.id);
    await expect(exigirDueno()).rejects.toThrow("NOT_FOUND");
  });

  it("sin sesión va a /ingresar", async () => {
    await expect(exigirDueno()).rejects.toThrow("REDIRECT /ingresar");
  });
});
