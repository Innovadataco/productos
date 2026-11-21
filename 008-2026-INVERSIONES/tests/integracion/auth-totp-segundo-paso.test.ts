// Segundo paso del ingreso (TOTP) contra la base de PRUEBAS: código correcto, antireplay, códigos de
// recuperación de un solo uso, la pre-sesión ligada a la base (solo vale la más reciente y una vez),
// carreras, bloqueo que se duplica dentro de 24 h y re-cifrado con la clave activa. Cada prueba usa su
// cuenta, su IP (RFC 3849) y su reloj. El secreto es el del apéndice de RFC 6238 (público).
import { PrismaClient, type ResultadoIngreso } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hashClave } from "@/auth/clave";
import { crearCodigosRecuperacion } from "@/auth/codigos";
import { ingresar } from "@/auth/ingreso";
import { redDeIp } from "@/auth/ip";
import { BLOQUEO_MS } from "@/auth/limites";
import { generarJti, hashJti, type DatosPresesion } from "@/auth/presesion";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { estadoDelSegundoPaso, verificarSegundoPaso } from "@/auth/segundo-paso";
import { pasoDe } from "@/auth/totp";
import { sqlUltimoReinicio } from "@/auth/fallos-segundo-paso";
import { fallosDeIp, sqlFallosDeIp } from "@/auth/topes";
import { SECRETO_RFC, activarTotp, codigoEn, codigoMalo } from "./auth-totp-ayudas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-segundo-paso";
const MIN = 60;
let hash = "";
let n = 0;
let ipBase = 0;
/** Una /64 de documentación (RFC 3849) por intento y por corrida: no la comparte ninguna otra prueba. */
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:b${(ipBase += 1).toString(16)}::1`;
/** Relojes en 2032, cada prueba en su hora: los conteos de 15 min y 24 h no se cruzan. */
const reloj = (horas: number) => (segundos = 0) => new Date(Date.UTC(2032, 0, 1) + horas * 3_600_000 + segundos * 1000);

async function cuenta(ahora: Date): Promise<{ id: string; email: string }> {
  const email = `segundo-paso-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const u = await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } });
  await activarTotp(db, u.id, ahora, pasoDe(ahora.getTime()) - 10);
  return { id: u.id, email };
}

/** Una pre-sesión vigente, como la deja el paso de la clave (el hash de su jti en la base). */
async function presesion(usuarioId: string): Promise<DatosPresesion> {
  const jti = generarJti();
  const u = await db.usuario.update({ where: { id: usuarioId }, data: { presesionHash: hashJti(jti) } });
  return { sub: usuarioId, sesionVersion: u.sesionVersion, jti };
}

const intentar = async (usuarioId: string, codigo: string, ahora: Date, ip = ipNueva()) =>
  verificarSegundoPaso(db, { presesion: await presesion(usuarioId), codigo, ip, ahora });

const resultados = async (usuarioId: string): Promise<ResultadoIngreso[]> =>
  (await db.intentoIngreso.findMany({ where: { usuarioId }, orderBy: [{ ocurridoEn: "asc" }, { id: "asc" }], select: { resultado: true } })).map(
    (r) => r.resultado,
  );

const leer = (id: string) => db.usuario.findUniqueOrThrow({ where: { id } });

/** `k` fallos seguidos, un segundo aparte cada uno. */
async function fallar(usuarioId: string, t: (s?: number) => Date, desde: number, k: number): Promise<void> {
  for (let i = 0; i < k; i += 1) {
    expect(await intentar(usuarioId, codigoMalo(t(desde + i)), t(desde + i))).toMatchObject({ ok: false, motivo: "FALLO" });
  }
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  hash = await hashClave(CLAVE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("con el código TOTP", () => {
  it("el correcto abre la sesión, guarda el paso, gasta la pre-sesión y lo registra", async () => {
    const t = reloj(1);
    const u = await cuenta(t());
    const ip = ipNueva();
    const r = await intentar(u.id, codigoEn(t()), t(), ip);
    expect(r).toEqual({ ok: true, usuarioId: u.id, sesionVersion: 1, via: "TOTP", restantes: null });
    const fila = await leer(u.id);
    expect(fila.totpUltimoPaso).toBe(pasoDe(t().getTime()));
    expect(fila.presesionHash).toBeNull();
    expect(await db.intentoIngreso.findFirst({ where: { usuarioId: u.id, resultado: "TOTP_EXITO" }, select: { ip: true } })).toEqual({ ip });
  });

  it("antireplay: el mismo código, con otra pre-sesión, ya no entra (TOTP_REPETIDO)", async () => {
    const t = reloj(2);
    const u = await cuenta(t());
    const codigo = codigoEn(t());
    expect(await intentar(u.id, codigo, t())).toMatchObject({ ok: true });
    expect(await intentar(u.id, codigo, t(5))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await resultados(u.id)).toEqual(["TOTP_EXITO", "TOTP_REPETIDO"]);
  });

  it("el del paso siguiente (ventana +1) entra después del actual", async () => {
    const t = reloj(3);
    const u = await cuenta(t());
    expect(await intentar(u.id, codigoEn(t()), t())).toMatchObject({ ok: true });
    expect(await intentar(u.id, codigoEn(t(), 1), t(1))).toMatchObject({ ok: true });
  });

  it("el código con espacios («123 456», como lo muestran las apps) entra igual", async () => {
    const t = reloj(80);
    const u = await cuenta(t());
    const codigo = codigoEn(t());
    expect(await intentar(u.id, ` ${codigo.slice(0, 3)} ${codigo.slice(3)} `, t())).toMatchObject({ ok: true, via: "TOTP" });
  });

  it("un código errado o sin la forma es TOTP_INCORRECTO, con el mismo fallo genérico", async () => {
    const t = reloj(4);
    const u = await cuenta(t());
    expect(await intentar(u.id, codigoMalo(t()), t())).toEqual({ ok: false, motivo: "FALLO" });
    expect(await intentar(u.id, "12ab", t(1))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await resultados(u.id)).toEqual(["TOTP_INCORRECTO", "TOTP_INCORRECTO"]);
    expect((await leer(u.id)).totpUltimoPaso).toBe(pasoDe(t().getTime()) - 10);
  });

  it("carrera: dos pedidos a la vez con el mismo código y la misma pre-sesión, entra exactamente uno", async () => {
    const t = reloj(5);
    const u = await cuenta(t());
    const pre = await presesion(u.id);
    const codigo = codigoEn(t());
    const rs = await Promise.all([1, 2, 3].map(() => verificarSegundoPaso(db, { presesion: pre, codigo, ip: ipNueva(), ahora: t() })));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });

  it("la cuenta se toma con FOR UPDATE: si otro pedido la cambió mientras esperaba, decide con lo nuevo", async () => {
    const t = reloj(70);
    const u = await cuenta(t());
    const pre = await presesion(u.id);
    let avisar: () => void = () => undefined;
    const tomada = new Promise<void>((r) => (avisar = r));
    // Otro pedido toma la fila, «entra» (gasta la pre-sesión y el paso) y confirma después de que este empezó.
    const otro = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "usuario" WHERE "id" = ${u.id} FOR UPDATE`;
      avisar();
      await new Promise((r) => setTimeout(r, 400));
      await tx.usuario.update({ where: { id: u.id }, data: { presesionHash: null, totpUltimoPaso: pasoDe(t().getTime()) } });
    });
    await tomada;
    const competidor = verificarSegundoPaso(db, { presesion: pre, codigo: codigoEn(t()), ip: ipNueva(), ahora: t() });
    await otro;
    expect(await competidor).toEqual({ ok: false, motivo: "PRESESION_INVALIDA" });
  });

  it("carrera: dos pre-sesiones con el mismo código: solo vale la más reciente y entra una vez", async () => {
    const t = reloj(6);
    const u = await cuenta(t());
    const codigo = codigoEn(t());
    const jtis = [generarJti(), generarJti()];
    const version = (await leer(u.id)).sesionVersion;
    // La base solo guarda una: la otra pre-sesión ya no vale, y el código solo entra una vez.
    await db.usuario.update({ where: { id: u.id }, data: { presesionHash: hashJti(jtis[1] ?? "") } });
    const rs = await Promise.all(
      jtis.map((jti) => verificarSegundoPaso(db, { presesion: { sub: u.id, sesionVersion: version, jti }, codigo, ip: ipNueva(), ahora: t() })),
    );
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("la pre-sesión, ligada a la base", () => {
  it.each([
    ["fue reemplazada por un ingreso más reciente (otro jti)", async (id: string) => ({ ...(await presesion(id)), jti: generarJti() })],
    ["es de una versión de sesión anterior (clave cambiada o «salir»)", async (id: string) => {
      const pre = await presesion(id);
      await db.usuario.update({ where: { id }, data: { sesionVersion: { increment: 1 } } });
      return pre;
    }],
    ["es de una cuenta que no existe", async () => ({ sub: `no-existe-${corrida}`, sesionVersion: 1, jti: generarJti() })],
  ])("no sirve si %s: no se evalúa el código ni se registra nada", async (_caso, armar) => {
    const t = reloj(7);
    const u = await cuenta(t());
    const pre = await armar(u.id);
    expect(await verificarSegundoPaso(db, { presesion: pre, codigo: codigoEn(t()), ip: ipNueva(), ahora: t() })).toEqual({
      ok: false,
      motivo: "PRESESION_INVALIDA",
    });
    expect(await resultados(u.id)).toEqual([]);
  });

  it("se gasta al entrar: la misma pre-sesión no sirve para un segundo ingreso", async () => {
    const t = reloj(8);
    const u = await cuenta(t());
    const pre = await presesion(u.id);
    expect(await verificarSegundoPaso(db, { presesion: pre, codigo: codigoEn(t()), ip: ipNueva(), ahora: t() })).toMatchObject({ ok: true });
    expect(await verificarSegundoPaso(db, { presesion: pre, codigo: codigoEn(t(), 1), ip: ipNueva(), ahora: t(1) })).toEqual({
      ok: false,
      motivo: "PRESESION_INVALIDA",
    });
  });

  it("sirve para varios intentos fallidos mientras no venza ni se reemplace", async () => {
    const t = reloj(9);
    const u = await cuenta(t());
    const pre = await presesion(u.id);
    expect(await verificarSegundoPaso(db, { presesion: pre, codigo: codigoMalo(t()), ip: ipNueva(), ahora: t() })).toMatchObject({ motivo: "FALLO" });
    expect(await verificarSegundoPaso(db, { presesion: pre, codigo: codigoEn(t()), ip: ipNueva(), ahora: t(1) })).toMatchObject({ ok: true });
  });

  it("una cuenta sin TOTP activo no pasa por aquí (le toca enrolar)", async () => {
    const t = reloj(10);
    const u = await db.usuario.create({ data: { email: `sin-totp-${corrida}@ejemplo.invalid`, rol: "DUENO", claveHash: hash } });
    expect(await intentar(u.id, codigoEn(t()), t())).toEqual({ ok: false, motivo: "PRESESION_INVALIDA" });
  });
});

describe("con un código de recuperación", () => {
  it("uno vigente entra, se gasta y dice cuántos quedan; el mismo otra vez ya no", async () => {
    const t = reloj(11);
    const u = await cuenta(t());
    const codigos = await db.$transaction((tx) => crearCodigosRecuperacion(tx, u.id, t()));
    const [primero = ""] = codigos;
    expect(await intentar(u.id, primero.toLowerCase(), t(1))).toEqual({ ok: true, usuarioId: u.id, sesionVersion: 1, via: "RECUPERACION", restantes: 9 });
    expect(await intentar(u.id, primero, t(2))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await resultados(u.id)).toEqual(["RECUPERACION_USADA", "RECUPERACION_INVALIDA"]);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: { not: null } } })).toBe(1);
  });

  it("no sirve el de otra cuenta, ni uno inventado", async () => {
    const t = reloj(12);
    const [a, b] = [await cuenta(t()), await cuenta(t())];
    const [deB = ""] = await db.$transaction((tx) => crearCodigosRecuperacion(tx, b.id, t()));
    expect(await intentar(a.id, deB, t(1))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await intentar(a.id, "ABCD-EFGH-JKMN-PQRS", t(2))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: b.id, usadoEn: { not: null } } })).toBe(0);
  });

  it("carrera: el mismo código en dos pedidos a la vez se gasta una sola vez", async () => {
    const t = reloj(13);
    const u = await cuenta(t());
    const [codigo = ""] = await db.$transaction((tx) => crearCodigosRecuperacion(tx, u.id, t()));
    const pre = await presesion(u.id);
    const rs = await Promise.all([1, 2].map(() => verificarSegundoPaso(db, { presesion: pre, codigo, ip: ipNueva(), ahora: t(1) })));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.codigoRecuperacion.count({ where: { usuarioId: u.id, usadoEn: { not: null } } })).toBe(1);
  });
});

describe("bloqueo del segundo paso", () => {
  it("5 fallos bloquean 15 min: después ni el código correcto ni la clave entran", async () => {
    const t = reloj(20);
    const u = await cuenta(t());
    await fallar(u.id, t, 0, 5);
    expect((await leer(u.id)).bloqueadoHasta).toEqual(new Date(t(4).getTime() + BLOQUEO_MS));
    expect(await intentar(u.id, codigoEn(t(10)), t(10))).toEqual({ ok: false, motivo: "FALLO" });
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(11) })).toEqual({ ok: false, motivo: "CUENTA_BLOQUEADA" });
    const r = await resultados(u.id);
    expect(r.filter((x) => x === "BLOQUEO_SEGUNDO_PASO")).toHaveLength(1);
    expect(r.at(-2)).toBe("CUENTA_BLOQUEADA");
    // Vencido el bloqueo, el código correcto entra.
    expect(await intentar(u.id, codigoEn(t(20 * MIN)), t(20 * MIN))).toMatchObject({ ok: true });
  });

  it("volver a pasar la clave NO reinicia el conteo de fallos del TOTP", async () => {
    const t = reloj(21);
    const u = await cuenta(t());
    await fallar(u.id, t, 0, 3);
    expect(await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(5) })).toMatchObject({ ok: true, paso: "totp" });
    await fallar(u.id, t, 6, 2);
    expect((await leer(u.id)).bloqueadoHasta).not.toBeNull();
  });

  it("un éxito del segundo paso o una clave definida con enlace sí lo reinician", async () => {
    const t = reloj(22);
    const u = await cuenta(t());
    await fallar(u.id, t, 0, 4);
    expect(await intentar(u.id, codigoEn(t(10)), t(10))).toMatchObject({ ok: true });
    await fallar(u.id, t, 11, 4);
    await db.intentoIngreso.create({ data: { usuarioId: u.id, resultado: "CLAVE_DEFINIDA", ocurridoEn: t(20) } });
    await fallar(u.id, t, 21, 4);
    expect((await leer(u.id)).bloqueadoHasta).toBeNull();
  });

  /** Encadena bloqueos: tras cada uno, 5 fallos `espera` segundos después de que termina. Devuelve sus minutos. */
  async function encadenar(id: string, t: (s?: number) => Date, desde: number, cuantos: number, espera = 1): Promise<{ minutos: number[]; siguiente: number }> {
    const minutos: number[] = [];
    let s = desde;
    for (let k = 0; k < cuantos; k += 1) {
      await fallar(id, t, s, 5);
      const fin = (await leer(id)).bloqueadoHasta?.getTime() ?? 0;
      minutos.push((fin - t(s + 4).getTime()) / 60_000);
      s = Math.ceil((fin - t().getTime()) / 1000) + espera;
    }
    return { minutos, siguiente: s };
  }

  it("cada bloqueo que sigue a otro (antes de 24 h de su fin) dura el doble, llega a 24 h y se queda ahí", async () => {
    const t = reloj(100);
    const u = await cuenta(t());
    const { minutos } = await encadenar(u.id, t, 0, 10);
    expect(minutos).toEqual([15, 30, 60, 120, 240, 480, 960, 1440, 1440, 1440]);
  }, 60_000);

  it("si pasan 24 h desde el fin del último bloqueo, el siguiente vuelve a 15 min", async () => {
    const t = reloj(300);
    const u = await cuenta(t());
    const primero = await encadenar(u.id, t, 0, 2);
    expect(primero.minutos).toEqual([15, 30]);
    const despues = await encadenar(u.id, t, primero.siguiente + 24 * 3600, 1);
    expect(despues.minutos).toEqual([15]);
  });

  it("un éxito del segundo paso también lo vuelve a 15 min", async () => {
    const t = reloj(330);
    const u = await cuenta(t());
    const antes = await encadenar(u.id, t, 0, 3);
    expect(antes.minutos).toEqual([15, 30, 60]);
    expect(await intentar(u.id, codigoEn(t(antes.siguiente)), t(antes.siguiente))).toMatchObject({ ok: true });
    expect((await encadenar(u.id, t, antes.siguiente + 1, 1)).minutos).toEqual([15]);
  });

  it("el último reinicio del conteo usa su índice parcial", async () => {
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<{ "QUERY PLAN": string }[]>`EXPLAIN ${sqlUltimoReinicio("u-explain")}`;
    });
    expect(plan.map((p) => p["QUERY PLAN"]).join("\n")).toContain("intento_ingreso_reinicio_totp_idx");
  });

  it("los fallos del segundo paso cuentan para el tope por IP; sus éxitos no", async () => {
    const t = reloj(40);
    const u = await cuenta(t());
    // Una /64 de documentación (RFC 3849) propia de esta corrida: no la comparte ninguna otra prueba.
    const ip = `2001:db8:${(Date.now() % 0xffff).toString(16)}:7::1`;
    await intentar(u.id, codigoMalo(t()), t(), ip);
    await intentar(u.id, codigoEn(t(1)), t(1), ip);
    expect(await fallosDeIp(db, redDeIp(ip), t(2))).toBe(1);
  });

  it("el conteo por IP sigue usando el índice parcial del login", async () => {
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<{ "QUERY PLAN": string }[]>`EXPLAIN ${sqlFallosDeIp("203.0.113.0/32", new Date())}`;
    });
    expect(plan.map((p) => p["QUERY PLAN"]).join("\n")).toContain("intento_ingreso_fallos_ip_idx");
  });
});

describe("re-cifrado con la clave activa (rotación)", () => {
  it("un secreto cifrado con una clave vieja se re-cifra con la activa al entrar", async () => {
    const t = reloj(50);
    const u = await cuenta(t());
    expect(((await leer(u.id)).totpSecreto as { kid: string }).kid).toBe("v1");
    vi.stubEnv("CIFRADO_CLAVE_V2", randomBytes(32).toString("base64"));
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v2");
    expect(await intentar(u.id, codigoEn(t()), t())).toMatchObject({ ok: true });
    const fila = await leer(u.id);
    expect((fila.totpSecreto as { kid: string }).kid).toBe("v2");
    expect(descifrarSecretoTotp(fila.totpSecreto, u.id).equals(SECRETO_RFC)).toBe(true);
  });
});

describe("estadoDelSegundoPaso (lo que decide la página /totp)", () => {
  it("con TOTP activo y la pre-sesión vigente: VERIFICAR; sin TOTP: ENROLAR; reemplazada: VENCIDA", async () => {
    const t = reloj(60);
    const u = await cuenta(t());
    const pre = await presesion(u.id);
    expect(await estadoDelSegundoPaso(db, pre)).toBe("VERIFICAR");
    expect(await estadoDelSegundoPaso(db, { ...pre, jti: generarJti() })).toBe("VENCIDA");
    const sin = await db.usuario.create({ data: { email: `estado-${corrida}@ejemplo.invalid`, rol: "DUENO", claveHash: hash } });
    expect(await estadoDelSegundoPaso(db, await presesion(sin.id))).toBe("ENROLAR");
  });
});
