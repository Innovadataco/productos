// Primer paso con TOTP contra la base de PRUEBAS: la clave correcta ya no abre la sesión, deja una
// pre-sesión (solo vale la más reciente) y dice el paso siguiente. Sin TOTP activo y dentro de la ventana
// de enrolamiento (30 min después de definir la clave con un enlace o de `--reiniciar-totp`), deja además
// un secreto pendiente nuevo, cifrado y atado a su cuenta. Datos inventados (`@ejemplo.invalid`, IP de RFC 3849).
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hashClave } from "@/auth/clave";
import { ingresar } from "@/auth/ingreso";
import { hashJti } from "@/auth/presesion";
import { descifrarSecretoTotp } from "@/auth/secreto-totp";
import { ErrorCifrado } from "@/cifrado/errores";
import { activarTotp } from "./auth-totp-ayudas";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE = "clave-ficticia-totp-ingreso";
const MIN = 60;
let hash = "";
let n = 0;
/** Una /64 de documentación (RFC 3849) por intento y por corrida: no la comparte ninguna otra prueba. */
const ipNueva = () => `2001:db8:${(Date.now() % 0xffff).toString(16)}:a${(n += 1).toString(16)}::1`;
const reloj = (horas: number) => (segundos = 0) => new Date(Date.UTC(2031, 0, 1) + horas * 3_600_000 + segundos * 1000);

async function cuenta(): Promise<{ id: string; email: string }> {
  const email = `totp-ingreso-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const u = await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } });
  return { id: u.id, email };
}

const marcar = (usuarioId: string, resultado: "CLAVE_DEFINIDA" | "TOTP_REINICIADO", ocurridoEn: Date) =>
  db.intentoIngreso.create({ data: { usuarioId, resultado, ocurridoEn } });

const leer = (id: string) => db.usuario.findUniqueOrThrow({ where: { id } });

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

describe("ingresar con la clave correcta", () => {
  it("sin TOTP y dentro de la ventana: paso «enrolar», pre-sesión guardada y un secreto pendiente de 160 bits", async () => {
    const u = await cuenta();
    const t = reloj(1);
    await marcar(u.id, "CLAVE_DEFINIDA", t(-10 * MIN));
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    expect(r).toMatchObject({ ok: true, usuarioId: u.id, sesionVersion: 1, paso: "enrolar" });
    if (!r.ok) throw new Error("debía entrar");
    expect(r.jti).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const fila = await leer(u.id);
    expect(fila.presesionHash).toBe(hashJti(r.jti));
    expect(fila.totpActivadoEn).toBeNull();
    expect(descifrarSecretoTotp(fila.totpSecreto, u.id)).toHaveLength(20);
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "EXITO" } })).toBe(1);
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "TOTP_PENDIENTE" } })).toBe(1);
  });

  it("el sobre del secreto está atado a su cuenta: copiado a otra no se descifra", async () => {
    const [a, b] = [await cuenta(), await cuenta()];
    const t = reloj(2);
    await marcar(a.id, "CLAVE_DEFINIDA", t(-MIN));
    await ingresar(db, { email: a.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    const sobre = (await leer(a.id)).totpSecreto;
    expect(() => descifrarSecretoTotp(sobre, b.id)).toThrow(ErrorCifrado);
  });

  it("un --reiniciar-totp reciente también abre la ventana", async () => {
    const u = await cuenta();
    const t = reloj(3);
    await marcar(u.id, "TOTP_REINICIADO", t(-29 * MIN));
    await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    expect((await leer(u.id)).totpSecreto).not.toBeNull();
  });

  it.each([
    ["la clave se definió hace más de 30 min", -31 * MIN],
    ["no hay ningún enlace ni reinicio (clave puesta a mano)", null],
  ])("fuera de la ventana (%s): paso «enrolar» pero sin secreto pendiente", async (_caso, hace) => {
    const u = await cuenta();
    const t = reloj(4);
    if (hace !== null) await marcar(u.id, "CLAVE_DEFINIDA", t(hace));
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    expect(r).toMatchObject({ ok: true, paso: "enrolar" });
    expect((await leer(u.id)).totpSecreto).toBeNull();
  });

  it("con TOTP activo: paso «totp», sin tocar el secreto ni el último paso", async () => {
    const u = await cuenta();
    const t = reloj(5);
    await activarTotp(db, u.id, t(-3600), 7);
    const antes = await leer(u.id);
    const r = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    expect(r).toMatchObject({ ok: true, paso: "totp" });
    const despues = await leer(u.id);
    expect(despues.totpSecreto).toEqual(antes.totpSecreto);
    expect(despues.totpUltimoPaso).toBe(7);
    if (r.ok) expect(despues.presesionHash).toBe(hashJti(r.jti));
  });

  it("cada ingreso reemplaza la pre-sesión, pero reusa el secreto pendiente de la misma ventana (el QR escaneado sigue)", async () => {
    const u = await cuenta();
    const t = reloj(6);
    await marcar(u.id, "CLAVE_DEFINIDA", t(-MIN));
    const r1 = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
    const s1 = descifrarSecretoTotp((await leer(u.id)).totpSecreto, u.id);
    const r2 = await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(5) });
    const fila = await leer(u.id);
    if (!r1.ok || !r2.ok) throw new Error("debían entrar");
    expect(r2.jti).not.toBe(r1.jti);
    expect(fila.presesionHash).toBe(hashJti(r2.jti));
    expect(descifrarSecretoTotp(fila.totpSecreto, u.id).equals(s1)).toBe(true);
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "TOTP_PENDIENTE" } })).toBe(1);
  });

  it.each(["CLAVE_DEFINIDA", "TOTP_REINICIADO"] as const)(
    "una ventana nueva (%s) reemplaza el secreto pendiente y lo registra",
    async (apertura) => {
      const u = await cuenta();
      const t = reloj(9);
      await marcar(u.id, "CLAVE_DEFINIDA", t(-MIN));
      await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() });
      const s1 = descifrarSecretoTotp((await leer(u.id)).totpSecreto, u.id);
      await marcar(u.id, apertura, t(10));
      await ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t(20) });
      expect(descifrarSecretoTotp((await leer(u.id)).totpSecreto, u.id).equals(s1)).toBe(false);
      expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "TOTP_PENDIENTE" } })).toBe(2);
    },
  );

  it("una clave incorrecta no escribe pre-sesión ni secreto", async () => {
    const u = await cuenta();
    const t = reloj(7);
    await marcar(u.id, "CLAVE_DEFINIDA", t(-MIN));
    expect(await ingresar(db, { email: u.email, clave: "clave-equivocada-ficticia", ip: ipNueva(), ahora: t() })).toMatchObject({ ok: false });
    expect(await leer(u.id)).toMatchObject({ presesionHash: null, totpSecreto: null });
  });

  it("sin llavero de cifrado falla cerrado: no deja secreto, pre-sesión ni EXITO", async () => {
    const u = await cuenta();
    const t = reloj(8);
    await marcar(u.id, "CLAVE_DEFINIDA", t(-MIN));
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "");
    await expect(ingresar(db, { email: u.email, clave: CLAVE, ip: ipNueva(), ahora: t() })).rejects.toThrow(ErrorCifrado);
    expect(await leer(u.id)).toMatchObject({ presesionHash: null, totpSecreto: null });
    expect(await db.intentoIngreso.count({ where: { usuarioId: u.id, resultado: "EXITO" } })).toBe(0);
  });
});
