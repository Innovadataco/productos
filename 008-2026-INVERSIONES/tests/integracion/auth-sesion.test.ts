// Revalidación de la sesión contra la base (D-014): el JWT solo dice quién y qué versión de sesión;
// el rol, si la cuenta está activa, la versión vigente y que tenga el TOTP activo salen de la base en
// cada página y API (la sesión solo nace del segundo paso; una pre-sesión nunca la reemplaza).
// Datos inventados contra la base de PRUEBAS.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { firmarPresesion, generarJti } from "@/auth/presesion";
import { firmarToken } from "@/auth/token";
import { exigirSesionApi, validarSesion } from "@/auth/sesion";
import { activarTotp } from "./auth-totp-ayudas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = new TextEncoder().encode("k".repeat(32));
const OTRA = new TextEncoder().encode("q".repeat(32));
/** Hash de forma válida (no corresponde a ninguna contraseña usada). */
const HASH = `$2b$12$${"b".repeat(53)}`;
const AHORA = Date.now();
let n = 0;

interface DatosCuenta {
  readonly rol?: "DUENO" | "FAMILIA";
  readonly activo?: boolean;
  readonly claveHash?: string | null;
  readonly sesionVersion?: number;
  readonly totp?: boolean;
}

async function cuenta(datos: DatosCuenta = {}) {
  const u = await db.usuario.create({
    data: {
      email: `sesion-${corrida}-${(n += 1)}@ejemplo.invalid`,
      rol: datos.rol ?? "DUENO",
      activo: datos.activo ?? true,
      claveHash: datos.claveHash === undefined ? HASH : datos.claveHash,
      sesionVersion: datos.sesionVersion ?? 1,
    },
  });
  if (datos.totp !== false) await activarTotp(db, u.id, new Date(AHORA));
  return u;
}

const token = (sub: string, sesionVersion = 1, clave = CLAVE) => firmarToken({ sub, sesionVersion }, clave, AHORA);

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("validarSesion", () => {
  it("un dueño activo con la versión vigente tiene sesión (el rol sale de la base)", async () => {
    const u = await cuenta();
    expect(await validarSesion(db, await token(u.id), CLAVE, AHORA)).toEqual({ id: u.id, email: u.email, rol: "DUENO" });
  });

  it("un familiar activo con clave, TOTP y la versión vigente tiene sesión, con su rol FAMILIA (frente familia-lectura)", async () => {
    const u = await cuenta({ rol: "FAMILIA" });
    expect(await validarSesion(db, await token(u.id), CLAVE, AHORA)).toEqual({ id: u.id, email: u.email, rol: "FAMILIA" });
  });

  it.each([
    ["la cuenta está inactiva", { activo: false }, 1],
    ["la versión de sesión cambió (clave cambiada o «cerrar todas»)", { sesionVersion: 2 }, 1],
    ["el familiar está revocado (inactivo)", { rol: "FAMILIA" as const, activo: false }, 1],
    ["el familiar no tiene el TOTP activo", { rol: "FAMILIA" as const, totp: false }, 1],
    ["la versión de sesión del familiar cambió (revocado o «Salir»)", { rol: "FAMILIA" as const, sesionVersion: 2 }, 1],
    ["la cuenta ya no tiene clave", { claveHash: null }, 1],
    ["la cuenta no tiene el TOTP activo (sin enrolar o reiniciado)", { totp: false }, 1],
  ])("no hay sesión si %s", async (_caso, datos, version) => {
    const u = await cuenta(datos);
    expect(await validarSesion(db, await token(u.id, version), CLAVE, AHORA)).toBeNull();
  });

  it("no hay sesión con un token de otro secreto, de un usuario que no existe o sin token", async () => {
    const u = await cuenta();
    expect(await validarSesion(db, await token(u.id, 1, OTRA), CLAVE, AHORA)).toBeNull();
    expect(await validarSesion(db, await token(`no-existe-${corrida}`), CLAVE, AHORA)).toBeNull();
    expect(await validarSesion(db, undefined, CLAVE, AHORA)).toBeNull();
  });

  it("una pre-sesión no sirve como sesión, ni siquiera con la versión y el secreto correctos", async () => {
    const u = await cuenta();
    const pre = await firmarPresesion({ sub: u.id, sesionVersion: 1, jti: generarJti() }, CLAVE, AHORA);
    expect(await validarSesion(db, pre, CLAVE, AHORA)).toBeNull();
  });

  it("exigirSesionApi da el usuario con sesión, y 401 JSON sin caché sin ella", async () => {
    process.env.AUTH_SECRET = "k".repeat(32);
    const u = await cuenta();
    const conCookie = new Request("http://127.0.0.1:5008/api/plan", { headers: { cookie: `__Host-sesion=${await token(u.id)}` } });
    expect(await exigirSesionApi(conCookie)).toEqual({ ok: true, usuario: { id: u.id, email: u.email, rol: "DUENO" } });
    const r = await exigirSesionApi(new Request("http://127.0.0.1:5008/api/plan"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.respuesta.status).toBe(401);
      expect(r.respuesta.headers.get("cache-control")).toBe("no-store");
    }
  });
});
