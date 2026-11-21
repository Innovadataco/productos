// Lectura normal con una clave de cifrado RETIRADA (hueco de pruebas): tras rotar a la v2 y sacar la v1 del
// entorno, el único dato que la app descifra fuera de la migración, el secreto TOTP, ya no abre. Las rutas
// del segundo factor responden 503 con su mensaje fijo, sin caché, sin sesión y sin el error crudo; no
// escriben nada (ni fallo, ni bloqueo, ni pre-sesión gastada) y la app sigue sirviendo: /api/salud y una
// cuenta cifrada con la v2 entran igual. Contra la base de PRUEBAS. Datos inventados: correos
// @ejemplo.invalid, IP de documentación (RFC 3849), secreto del apéndice de RFC 6238 y claves aleatorias.
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashClave } from "@/auth/clave";
import { crearCodigosRecuperacion } from "@/auth/codigos";
import { firmarPresesion, generarJti, hashJti } from "@/auth/presesion";
import { cifrarSecretoTotp } from "@/auth/secreto-totp";
import { firmarToken } from "@/auth/token";
import { pasoDe } from "@/auth/totp";
import { activarTotp, codigoEn } from "./auth-totp-ayudas";

// Secreto de sesión inventado solo para esta prueba (se restaura el anterior en afterAll).
const AUTH_SECRET_ANTERIOR = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "secreto-ficticio-de-integracion-clave-retirada-0123";
const CLAVE_SESION = new TextEncoder().encode(process.env.AUTH_SECRET);

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const ORIGEN = "http://127.0.0.1:5008";
const CLAVE_V2 = randomBytes(32).toString("base64");
// La v1 de la corrida (vitest.integracion.config.ts), tomada antes de retirarla.
const CLAVE_V1 = process.env.CIFRADO_CLAVE_V1 ?? "";
let hash = "";
let n = 0;
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:e${(n += 1).toString(16)}::1`;

type Ruta = (r: Request) => Promise<Response>;
let totp: Ruta;
let enrolar: Ruta;
let codigos: Ruta;
let registro: ReturnType<typeof vi.spyOn>;

function pedido(ruta: string, cuerpo: unknown, cookie: string): Request {
  return new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { origin: ORIGEN, "content-type": "application/json", "cf-connecting-ip": ipNueva(), cookie },
    body: JSON.stringify(cuerpo),
  });
}

/** Rota a la v2 y RETIRA la v1: lo cifrado con la v1 ya no tiene clave. */
function retirarV1(): void {
  vi.stubEnv("CIFRADO_CLAVE_V2", CLAVE_V2);
  vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v2");
  vi.stubEnv("CIFRADO_CLAVE_V1", "");
}

async function cuentaNueva(): Promise<string> {
  const email = `clave-retirada-${corrida}-${(n += 1)}@ejemplo.invalid`;
  return (await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } })).id;
}

async function presesion(id: string): Promise<string> {
  const jti = generarJti();
  const { sesionVersion } = await db.usuario.update({ where: { id }, data: { presesionHash: hashJti(jti) } });
  return `__Host-presesion=${await firmarPresesion({ sub: id, sesionVersion, jti }, CLAVE_SESION, Date.now())}`;
}

/** Lo que una ruta que falló no debe haber tocado: la cuenta tal cual y sus intentos. */
const CAMPOS_FOTO = { totpSecreto: true, totpUltimoPaso: true, presesionHash: true, bloqueadoHasta: true, sesionVersion: true } as const;
const foto = async (id: string) => ({
  cuenta: await db.usuario.findUniqueOrThrow({ where: { id }, select: CAMPOS_FOTO }),
  intentos: await db.intentoIngreso.count({ where: { usuarioId: id } }),
  codigos: await db.codigoRecuperacion.findMany({
    where: { usuarioId: id },
    orderBy: { id: "asc" },
    select: { id: true, usadoEn: true, anuladoEn: true },
  }),
});

/** Un 503 del segundo factor: su mensaje fijo, sin caché, sin cookie de sesión y sin el error crudo. */
async function esperar503(r: Response, mensaje: string): Promise<void> {
  expect(r.status).toBe(503);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({ error: mensaje });
  expect(r.headers.getSetCookie().some((c) => c.startsWith("__Host-sesion="))).toBe(false);
}

/** El registro dice solo el código del error: ni su mensaje, ni la versión, ni las claves. */
function esperarRegistro(contexto: string): void {
  const registrado = registro.mock.calls.flat().map(String).join("\n");
  expect(registrado).toContain(`[sesion] ${contexto} (código: CLAVE_NO_DISPONIBLE)`);
  for (const filtrado of ["cuya clave no está cargada", "CIFRADO_CLAVE", CLAVE_V2, CLAVE_V1]) {
    expect(registrado, filtrado).not.toContain(filtrado);
  }
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  // Sin la v1 de la corrida, «retirarla» no probaría nada.
  if (CLAVE_V1 === "") throw new Error("Falta CIFRADO_CLAVE_V1 (la fija vitest.integracion.config.ts)");
  hash = await hashClave("clave-ficticia-clave-retirada");
  totp = (await import("@/app/api/sesion/totp/route")).POST;
  enrolar = (await import("@/app/api/sesion/totp/enrolar/route")).POST;
  codigos = (await import("@/app/api/sesion/totp/codigos/route")).POST;
});

beforeEach(() => {
  registro = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  registro.mockRestore();
});

afterAll(async () => {
  if (AUTH_SECRET_ANTERIOR === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = AUTH_SECRET_ANTERIOR;
  await db.$disconnect();
});

describe("segundo paso con la clave v1 retirada", () => {
  it("POST /api/sesion/totp responde 503 fijo y sin sesión; el registro trae solo CLAVE_NO_DISPONIBLE", async () => {
    const id = await cuentaNueva();
    await activarTotp(db, id, new Date(), pasoDe(Date.now()) - 10);
    const cookie = await presesion(id);
    const antes = await foto(id);
    retirarV1();
    const r = await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, cookie));
    await esperar503(r, "No se pudo verificar el código. Intente de nuevo.");
    esperarRegistro("no se pudo verificar el segundo paso");
    expect(await foto(id)).toEqual(antes);
  });

  it("no escribe nada: ni fallo, ni bloqueo, ni pre-sesión gastada; al volver la v1, el mismo código entra", async () => {
    const id = await cuentaNueva();
    await activarTotp(db, id, new Date(), pasoDe(Date.now()) - 10);
    const cookie = await presesion(id);
    const antes = await foto(id);
    retirarV1();
    expect((await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, cookie))).status).toBe(503);
    expect(await foto(id)).toEqual(antes);
    vi.unstubAllEnvs();
    expect((await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, cookie))).status).toBe(200);
  });

  it("la app no se cae: /api/salud sigue en 200 y una cuenta cifrada con la v2 entra con la v1 retirada", async () => {
    const vieja = await cuentaNueva();
    await activarTotp(db, vieja, new Date(), pasoDe(Date.now()) - 10);
    const cookieVieja = await presesion(vieja);
    retirarV1();
    const nueva = await cuentaNueva();
    await activarTotp(db, nueva, new Date(), pasoDe(Date.now()) - 10); // se cifra con la activa: v2
    const sobreNuevo = (await db.usuario.findUniqueOrThrow({ where: { id: nueva } })).totpSecreto as { kid: string };
    expect(sobreNuevo.kid).toBe("v2");
    expect((await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, cookieVieja))).status).toBe(503);
    expect((await totp(pedido("/api/sesion/totp", { codigo: codigoEn(new Date()) }, await presesion(nueva)))).status).toBe(200);
    const { GET } = await import("@/app/api/salud/route");
    expect((await GET()).status).toBe(200);
  });
});

describe("enrolar y regenerar códigos con la clave v1 retirada", () => {
  it("POST /api/sesion/totp/enrolar con el pendiente en v1: 503 fijo, sin sesión, y la cuenta queda igual", async () => {
    const id = await cuentaNueva();
    // La ventana de 30 min para enrolar, abierta.
    await db.intentoIngreso.create({ data: { usuarioId: id, resultado: "CLAVE_DEFINIDA", ocurridoEn: new Date() } });
    const secreto = Buffer.from("enrolar-retirada-fict", "ascii");
    await db.usuario.update({ where: { id }, data: { totpSecreto: cifrarSecretoTotp(secreto, id) } });
    const cookie = await presesion(id);
    const antes = await foto(id);
    retirarV1();
    const r = await enrolar(pedido("/api/sesion/totp/enrolar", { codigo: "123456" }, cookie));
    await esperar503(r, "No se pudo activar el segundo factor. Intente de nuevo.");
    esperarRegistro("no se pudo confirmar el enrolamiento");
    expect(await foto(id)).toEqual(antes);
  });

  it("POST /api/sesion/totp/codigos con el secreto en v1: 503 fijo y los códigos vigentes no cambian", async () => {
    const id = await cuentaNueva();
    await activarTotp(db, id, new Date(), pasoDe(Date.now()) - 10);
    await db.$transaction((tx) => crearCodigosRecuperacion(tx, id, new Date()));
    const { sesionVersion } = await db.usuario.findUniqueOrThrow({ where: { id } });
    const cookie = `__Host-sesion=${await firmarToken({ sub: id, sesionVersion }, CLAVE_SESION, Date.now())}`;
    const antes = await foto(id);
    retirarV1();
    const r = await codigos(pedido("/api/sesion/totp/codigos", { codigo: codigoEn(new Date()) }, cookie));
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "No se pudieron generar los códigos. Intente de nuevo." });
    esperarRegistro("no se pudieron regenerar los códigos");
    expect(await foto(id)).toEqual(antes);
    expect(antes.codigos).toHaveLength(10);
  });
});
