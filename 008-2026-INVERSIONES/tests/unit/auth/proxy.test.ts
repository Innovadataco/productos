// El proxy de Next 16 (D-014): exige sesión (firma del JWT) en todo menos las rutas públicas, verifica
// Origin en los POST, limita las API por IP y pone la CSP con nonce. Falla cerrada sin secreto.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firmarPresesion } from "@/auth/presesion";
import { firmarToken } from "@/auth/token";

/** Secreto inventado para la prueba. */
const SECRETO = "secreto-ficticio-del-proxy-0123456789abc";
const ORIGEN = "http://127.0.0.1:5008";
let ip = 0;

function pedido(ruta: string, datos: { metodo?: string; cabeceras?: Record<string, string> } = {}): NextRequest {
  ip += 1;
  return new NextRequest(`${ORIGEN}${ruta}`, {
    method: datos.metodo ?? "GET",
    headers: { "cf-connecting-ip": `198.51.100.${ip % 250}`, ...datos.cabeceras },
  });
}

async function proxy(p: NextRequest): Promise<Response> {
  const modulo = await import("@/proxy");
  return modulo.proxy(p);
}

const pasa = (r: Response) => r.headers.get("x-middleware-next") === "1";
const tokenValido = async () => `__Host-sesion=${await firmarToken({ sub: "u1", sesionVersion: 1 }, new TextEncoder().encode(SECRETO), Date.now())}`;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("AUTH_SECRET", SECRETO);
  vi.stubEnv("AUTH_SECRET_FILE", "");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy · sin sesión", () => {
  it("una página redirige a /ingresar, sin caché", async () => {
    const r = await proxy(pedido("/"));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location") ?? "", ORIGEN).pathname).toBe("/ingresar");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("una API responde 401 JSON, sin caché", async () => {
    const r = await proxy(pedido("/api/plan"));
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "No autenticado" });
  });

  it("un token falso redirige y borra la cookie", async () => {
    const r = await proxy(pedido("/", { cabeceras: { cookie: "__Host-sesion=falso.token.x" } }));
    expect(r.status).toBe(307);
    expect(r.headers.get("set-cookie")).toMatch(/^__Host-sesion=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
  });

  it("las rutas públicas pasan: /ingresar, /definir-clave, /api/salud y el POST de ingreso con Origin", async () => {
    expect(pasa(await proxy(pedido("/ingresar")))).toBe(true);
    expect(pasa(await proxy(pedido("/definir-clave")))).toBe(true);
    expect(pasa(await proxy(pedido("/api/salud")))).toBe(true);
    expect(pasa(await proxy(pedido("/api/sesion/ingresar", { metodo: "POST", cabeceras: { origin: ORIGEN } })))).toBe(true);
  });

  it.each([
    ["AUTH_DISABLED", "1"],
    ["DISABLE_AUTH", "true"],
    ["SKIP_AUTH", "1"],
    ["NODE_ENV", "development"],
  ])("no hay variable que apague el login (%s=%s sigue exigiendo sesión)", async (nombre, valor) => {
    vi.stubEnv(nombre, valor);
    expect((await proxy(pedido("/"))).status).toBe(307);
    expect((await proxy(pedido("/api/plan"))).status).toBe(401);
  });
});

describe("proxy · con sesión", () => {
  it("una página pasa con la CSP y el nonce también en la petición", async () => {
    const r = await proxy(pedido("/", { cabeceras: { cookie: await tokenValido() } }));
    expect(pasa(r)).toBe(true);
    const csp = r.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? "";
    expect(nonce).not.toBe("");
    expect(r.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(r.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("cada pedido lleva un nonce distinto", async () => {
    const cookie = await tokenValido();
    const a = (await proxy(pedido("/", { cabeceras: { cookie } }))).headers.get("content-security-policy");
    const b = (await proxy(pedido("/", { cabeceras: { cookie } }))).headers.get("content-security-policy");
    expect(a).not.toBe(b);
  });
});

describe("proxy · CSRF por Origin", () => {
  it.each([
    ["sin Origin", {}],
    ["con Origin «null»", { origin: "null" }],
    ["desde otro sitio", { origin: "https://atacante.example" }],
  ])("un POST %s recibe 403, aun con sesión", async (_caso, cabeceras) => {
    const r = await proxy(pedido("/api/sesion/salir", { metodo: "POST", cabeceras: { ...cabeceras, cookie: await tokenValido() } }));
    expect(r.status).toBe(403);
  });

  it("en producción sin APP_ORIGEN, un POST recibe 503 (falla cerrada)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "");
    expect((await proxy(pedido("/api/sesion/ingresar", { metodo: "POST", cabeceras: { origin: ORIGEN } }))).status).toBe(503);
  });

  it("en producción, el POST con el Origin de APP_ORIGEN pasa", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "https://inversiones.innovadataco.com");
    const r = await proxy(pedido("/api/sesion/ingresar", { metodo: "POST", cabeceras: { origin: "https://inversiones.innovadataco.com" } }));
    expect(pasa(r)).toBe(true);
  });
});

describe("proxy · orden de las guardias", () => {
  it("un POST a una ruta pública con Origin ajeno recibe 403", async () => {
    const r = await proxy(pedido("/api/sesion/ingresar", { metodo: "POST", cabeceras: { origin: "https://atacante.example" } }));
    expect(r.status).toBe(403);
  });

  it("un POST sin Origin a una ruta protegida, sin sesión, recibe 403 (no 401)", async () => {
    expect((await proxy(pedido("/api/sesion/salir", { metodo: "POST" }))).status).toBe(403);
  });

  it("en producción la redirección a /ingresar sale de APP_ORIGEN, no del Host del pedido", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "https://inversiones.innovadataco.com");
    const r = await proxy(pedido("/", { cabeceras: { host: "intruso.example" } }));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("https://inversiones.innovadataco.com/ingresar");
  });
});

describe("proxy · falla cerrada sin secreto", () => {
  it.each([
    ["sin AUTH_SECRET", ""],
    ["con un secreto corto", "corto"],
  ])("%s, una ruta protegida responde 503 (nunca pasa)", async (_caso, valor) => {
    vi.stubEnv("AUTH_SECRET", valor);
    expect((await proxy(pedido("/"))).status).toBe(503);
    expect((await proxy(pedido("/api/plan"))).status).toBe(503);
  });
});

describe("proxy · tope general de las API por IP (60 por minuto)", () => {
  it("el pedido 61 de una IP a /api/* recibe 429 con Retry-After; otra IP sigue", async () => {
    const cabeceras = { "cf-connecting-ip": "203.0.113.77" };
    for (let k = 0; k < 60; k += 1) expect((await proxy(pedido("/api/salud", { cabeceras }))).status, `pedido ${k + 1}`).not.toBe(429);
    const r = await proxy(pedido("/api/salud", { cabeceras }));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect((await proxy(pedido("/api/salud", { cabeceras: { "cf-connecting-ip": "203.0.113.78" } }))).status).not.toBe(429);
  });

  it("las páginas no cuentan para el tope de las API", async () => {
    const cabeceras = { "cf-connecting-ip": "203.0.113.79" };
    for (let k = 0; k < 70; k += 1) await proxy(pedido("/ingresar", { cabeceras }));
    expect((await proxy(pedido("/api/salud", { cabeceras }))).status).not.toBe(429);
  });
});

describe("proxy · pre-sesión del TOTP", () => {
  const presesion = async () =>
    firmarPresesion({ sub: "u1", sesionVersion: 1, jti: "j".repeat(43) }, new TextEncoder().encode(SECRETO), Date.now());

  it("las páginas del segundo paso pasan sin sesión (exigen la pre-sesión en el servidor)", async () => {
    for (const ruta of ["/totp", "/totp/enrolar"]) expect(pasa(await proxy(pedido(ruta))), ruta).toBe(true);
  });

  it("las API del segundo paso pasan sin sesión solo por POST y con Origin", async () => {
    for (const ruta of ["/api/sesion/totp", "/api/sesion/totp/enrolar"]) {
      expect(pasa(await proxy(pedido(ruta, { metodo: "POST", cabeceras: { origin: ORIGEN } }))), ruta).toBe(true);
      expect((await proxy(pedido(ruta, { metodo: "POST", cabeceras: { origin: "https://atacante.example" } }))).status, ruta).toBe(403);
    }
  });

  it("con solo la pre-sesión, una página protegida lleva a /ingresar y una API da 401", async () => {
    const cookie = `__Host-presesion=${await presesion()}`;
    const pagina = await proxy(pedido("/", { cabeceras: { cookie } }));
    expect(pagina.status).toBe(307);
    expect(new URL(pagina.headers.get("location") ?? "", ORIGEN).pathname).toBe("/ingresar");
    expect((await proxy(pedido("/api/plan", { cabeceras: { cookie } }))).status).toBe(401);
    expect((await proxy(pedido("/totp/codigos", { cabeceras: { cookie } }))).status).toBe(307);
  });

  it("la pre-sesión metida en la cookie de la sesión no pasa", async () => {
    const r = await proxy(pedido("/", { cabeceras: { cookie: `__Host-sesion=${await presesion()}` } }));
    expect(r.status).toBe(307);
    expect(r.headers.get("set-cookie")).toMatch(/^__Host-sesion=;/);
  });
});
