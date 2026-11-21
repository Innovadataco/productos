// POST /api/sesion/ingresar y POST /api/sesion/salir (D-014), llamados como Next los llama, contra la
// base de PRUEBAS. CSRF por Origin, cuerpo acotado, error genérico, cookie exacta y no-store.
// Datos inventados: correos `@ejemplo.invalid`, IP de documentación, contraseñas ficticias.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashClave } from "@/auth/clave";
import { hashJti, verificarPresesion } from "@/auth/presesion";
import { firmarToken, verificarToken } from "@/auth/token";
import { activarTotp } from "./auth-totp-ayudas";

// Secreto inventado solo para esta prueba (el proceso de vitest no lee ningún .env de producción).
process.env.AUTH_SECRET = "secreto-ficticio-de-integracion-0123456789";
const CLAVE_SESION = new TextEncoder().encode(process.env.AUTH_SECRET);

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-api-008";
const ORIGEN = "http://127.0.0.1:5008";
const GENERICO = "Usuario o contraseña incorrectos";
let email = "";
let usuarioId = "";
let n = 0;
const ipNueva = () => `198.51.100.${(n += 1)}`;

type Ruta = (r: Request) => Promise<Response>;
let ingresar: Ruta;
let salir: Ruta;

function pedido(ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { origin: ORIGEN, "content-type": "application/json", "cf-connecting-ip": ipNueva(), ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

const cookieDe = (r: Response) => r.headers.get("set-cookie") ?? "";

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  email = `api-${corrida}@ejemplo.invalid`;
  usuarioId = (await db.usuario.create({ data: { email, rol: "DUENO", claveHash: await hashClave(CLAVE) } })).id;
  ingresar = (await import("@/app/api/sesion/ingresar/route")).POST;
  salir = (await import("@/app/api/sesion/salir/route")).POST;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("POST /api/sesion/ingresar", () => {
  it("con la clave correcta responde 200, no-store y SOLO la pre-sesión (5 min), no la sesión", async () => {
    const r = await ingresar(pedido("/api/sesion/ingresar", { email, clave: CLAVE }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const cookies = r.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^__Host-presesion=[A-Za-z0-9._-]+; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=300$/);
    const token = /^__Host-presesion=([^;]+)/.exec(cookies[0] ?? "")?.[1] ?? "";
    const pre = await verificarPresesion(token, CLAVE_SESION, Date.now());
    expect(pre).toMatchObject({ sub: usuarioId, sesionVersion: 1 });
    expect(await verificarToken(token, CLAVE_SESION, Date.now())).toBeNull();
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuarioId } })).presesionHash).toBe(hashJti(pre?.jti ?? ""));
  });

  it("dice el paso siguiente: enrolar sin TOTP activo, totp con él", async () => {
    const sin = await ingresar(pedido("/api/sesion/ingresar", { email, clave: CLAVE }));
    expect(await sin.json()).toEqual({ ok: true, paso: "enrolar" });
    const conEmail = `api-totp-${corrida}@ejemplo.invalid`;
    const con = await db.usuario.create({ data: { email: conEmail, rol: "DUENO", claveHash: await hashClave(CLAVE) } });
    await activarTotp(db, con.id, new Date());
    const r = await ingresar(pedido("/api/sesion/ingresar", { email: conEmail, clave: CLAVE }));
    expect(await r.json()).toEqual({ ok: true, paso: "totp" });
  });

  it("registra la IP de Cf-Connecting-IP", async () => {
    await ingresar(pedido("/api/sesion/ingresar", { email, clave: CLAVE }, { "cf-connecting-ip": "198.51.100.250" }));
    expect(await db.intentoIngreso.count({ where: { usuarioId, ip: "198.51.100.250" } })).toBe(1);
  });

  it("clave incorrecta y correo inexistente dan la misma respuesta: 401 genérico, sin cookie", async () => {
    const mala = await ingresar(pedido("/api/sesion/ingresar", { email, clave: "clave-equivocada-ficticia" }));
    const nadie = await ingresar(pedido("/api/sesion/ingresar", { email: `nadie-${corrida}@ejemplo.invalid`, clave: CLAVE }));
    for (const r of [mala, nadie]) {
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(cookieDe(r)).toBe("");
      expect(await r.json()).toEqual({ error: GENERICO });
    }
  });

  it.each([
    ["sin Origin", { origin: "" }],
    ["con Origin «null» (formulario con no-referrer)", { origin: "null" }],
    ["desde otro sitio", { origin: "https://atacante.example" }],
  ])("rechaza con 403 un pedido %s", async (_caso, cabeceras) => {
    const p = pedido("/api/sesion/ingresar", { email, clave: CLAVE }, cabeceras);
    if (!cabeceras.origin) p.headers.delete("origin");
    const r = await ingresar(p);
    expect(r.status).toBe(403);
    expect(cookieDe(r)).toBe("");
  });

  it.each([
    ["que no es JSON", "email=x&clave=y", {}],
    ["con Content-Type de formulario", { email, clave: CLAVE }, { "content-type": "application/x-www-form-urlencoded" }],
    ["de más de 4 KB", { email, clave: "x".repeat(5000) }, {}],
    ["sin clave", { email }, {}],
    ["con campos de más", { email, clave: CLAVE, rol: "DUENO" }, {}],
    ["con el correo vacío", { email: " ", clave: CLAVE }, {}],
  ])("rechaza con 400 un cuerpo %s", async (_caso, cuerpo, cabeceras) => {
    const r = await ingresar(pedido("/api/sesion/ingresar", cuerpo, cabeceras));
    expect(r.status).toBe(400);
    expect(cookieDe(r)).toBe("");
  });
});

describe("POST /api/sesion/salir", () => {
  let idSalir = "";

  beforeAll(async () => {
    idSalir = (await db.usuario.create({ data: { email: `api-salir-${corrida}@ejemplo.invalid`, rol: "DUENO", claveHash: await hashClave(CLAVE) } })).id;
    await activarTotp(db, idSalir, new Date());
  });

  /** Una sesión completa (la que da el segundo paso), firmada con la versión vigente de la cuenta. */
  async function cookieValida(): Promise<string> {
    const { sesionVersion } = await db.usuario.findUniqueOrThrow({ where: { id: idSalir } });
    return `__Host-sesion=${await firmarToken({ sub: idSalir, sesionVersion }, CLAVE_SESION, Date.now())}`;
  }

  it("borra también la pre-sesión", async () => {
    const r = await salir(pedido("/api/sesion/salir", {}, { cookie: await cookieValida() }));
    expect(r.headers.getSetCookie().some((c) => /^__Host-presesion=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/.test(c))).toBe(true);
  });

  it("con sesión responde 200 y borra la cookie con los mismos atributos", async () => {
    const r = await salir(pedido("/api/sesion/salir", {}, { cookie: await cookieValida() }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(cookieDe(r)).toMatch(/^__Host-sesion=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
  });

  it("salir cierra TODAS las sesiones: un token copiado antes deja de valer", async () => {
    const copia = await cookieValida();
    const otra = await cookieValida();
    expect((await salir(pedido("/api/sesion/salir", {}, { cookie: otra }))).status).toBe(200);
    const token = copia.replace(/^__Host-sesion=/, "");
    const { validarSesion } = await import("@/auth/sesion");
    expect(await validarSesion(db, token, CLAVE_SESION, Date.now())).toBeNull();
    expect((await salir(pedido("/api/sesion/salir", {}, { cookie: copia }))).status).toBe(401);
  });

  it("sin sesión responde 401 y también borra la cookie", async () => {
    const r = await salir(pedido("/api/sesion/salir", {}, { cookie: "__Host-sesion=basura" }));
    expect(r.status).toBe(401);
    expect(cookieDe(r)).toMatch(/^__Host-sesion=;/);
  });

  it("desde otro sitio responde 403 y no toca la cookie (nadie le cierra la sesión desde fuera)", async () => {
    const r = await salir(pedido("/api/sesion/salir", {}, { cookie: await cookieValida(), origin: "https://atacante.example" }));
    expect(r.status).toBe(403);
    expect(cookieDe(r)).toBe("");
  });
});

describe("POST /api/sesion/definir-clave", () => {
  const NUEVA = "clave-ficticia-api-nueva";
  const INVALIDO = "El enlace no es válido o ya venció. Pida uno nuevo.";
  let definir: Ruta;
  let emailEnlace = "";

  beforeAll(async () => {
    definir = (await import("@/app/api/sesion/definir-clave/route")).POST;
    emailEnlace = `api-enlace-${corrida}@ejemplo.invalid`;
    await db.usuario.create({ data: { email: emailEnlace, rol: "DUENO" } });
  });

  const enlace = async () => (await (await import("@/auth/acceso")).emitirAcceso(db, { email: emailEnlace, ahora: new Date() })).token;

  it("con un enlace vigente responde 200, no-store, sin abrir sesión, y la clave nueva sirve para entrar", async () => {
    const r = await definir(pedido("/api/sesion/definir-clave", { token: await enlace(), clave: NUEVA }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(cookieDe(r)).toBe("");
    expect((await ingresar(pedido("/api/sesion/ingresar", { email: emailEnlace, clave: NUEVA }))).status).toBe(200);
  });

  it("un enlace inventado o ya usado responde 401 genérico", async () => {
    const token = await enlace();
    expect((await definir(pedido("/api/sesion/definir-clave", { token, clave: NUEVA }))).status).toBe(200);
    for (const t of [token, "z".repeat(43)]) {
      const r = await definir(pedido("/api/sesion/definir-clave", { token: t, clave: NUEVA }));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: INVALIDO });
    }
  });

  it("una clave fuera de 12 a 72 bytes responde 400 con la política y no gasta el enlace", async () => {
    const token = await enlace();
    const r = await definir(pedido("/api/sesion/definir-clave", { token, clave: "corta" }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/12 y 72 bytes/);
    expect((await definir(pedido("/api/sesion/definir-clave", { token, clave: NUEVA }))).status).toBe(200);
  });

  it("desde otro sitio responde 403; un cuerpo con campos de más, 400", async () => {
    const token = await enlace();
    expect((await definir(pedido("/api/sesion/definir-clave", { token, clave: NUEVA }, { origin: "https://atacante.example" }))).status).toBe(403);
    expect((await definir(pedido("/api/sesion/definir-clave", { token, clave: NUEVA, email: emailEnlace }))).status).toBe(400);
  });
});
