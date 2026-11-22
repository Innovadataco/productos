// Comando del acceso de un familiar (frente familia-lectura), `scripts/acceso-familiar.ts`. Lo corre Jelk, nunca la
// Fábrica: maneja accesos. Mismo modelo que crear-acceso-inicial: un enlace de un solo uso, clave propia y TOTP propio.
//   --email <correo>                   alta (o recuperación de la clave): imprime UNA vez el enlace
//   --email <correo> --revocar         lo desactiva y cierra sus sesiones
//   --email <correo> --reiniciar-totp  borra su segundo factor (perdió el teléfono y los códigos)
// Datos inventados (correos @ejemplo.invalid, token de relleno).
import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../../ayudas/cli";

const emitirAccesoFamiliar = vi.hoisted(() => vi.fn());
const revocarFamiliar = vi.hoisted(() => vi.fn());
const reiniciarTotpFamiliar = vi.hoisted(() => vi.fn());
vi.mock("@/auth/familia", async (original) => ({
  ...(await original<typeof import("@/auth/familia")>()),
  emitirAccesoFamiliar,
  revocarFamiliar,
  reiniciarTotpFamiliar,
}));

import { ErrorFamiliar } from "@/auth/familia";
import { ejecutar } from "@/auth/familia-cli";

const TOKEN = "f".repeat(43);
const CORREO = "familiar-cli@ejemplo.invalid";
const USO = "Uso: npx tsx scripts/acceso-familiar.ts --email <correo>";
const db = {} as never;
const LOCAL = { NODE_ENV: "development" } as const;

class Salida extends Writable {
  texto = "";
  override _write(trozo: Buffer, _codificacion: BufferEncoding, listo: () => void): void {
    this.texto += trozo.toString("utf8");
    listo();
  }
}

const consola = () => ({ salida: new Salida(), error: new Salida() });
/** Una base falsa que solo responde quién es el rol conectado. */
const conRol = (rol: string) => ({ $queryRaw: vi.fn().mockResolvedValue([{ rol }]) }) as never;
const ninguno = () => [emitirAccesoFamiliar, revocarFamiliar, reiniciarTotpFamiliar].every((f) => f.mock.calls.length === 0);

afterEach(() => {
  emitirAccesoFamiliar.mockReset();
  revocarFamiliar.mockReset();
  reiniciarTotpFamiliar.mockReset();
});

describe("acceso-familiar · alta y recuperación", () => {
  it("en producción (con inv_dueno) imprime UNA vez APP_ORIGEN/definir-clave#t=<token>&u=<correo>", async () => {
    emitirAccesoFamiliar.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u-4613", creado: true, proposito: "INICIAL" });
    const c = consola();
    const base = conRol("inv_dueno");
    const env = { NODE_ENV: "production", APP_ORIGEN: "https://inversiones.ejemplo.invalid" };
    expect(await ejecutar(["--email", CORREO], c, base, env)).toBe(0);
    const url = `https://inversiones.ejemplo.invalid/definir-clave#t=${TOKEN}&u=familiar-cli%40ejemplo.invalid`;
    expect(c.salida.texto.split(url)).toHaveLength(2);
    expect(c.salida.texto).toMatch(/familiar/i);
    expect(c.salida.texto).toMatch(/un solo uso/);
    expect(c.salida.texto).toMatch(/30 minutos/);
    expect(c.salida.texto).toMatch(/en persona o por un canal cifrado/);
    expect(c.salida.texto).toMatch(/solo lectura/i);
    expect(emitirAccesoFamiliar).toHaveBeenCalledWith(base, { email: CORREO, ahora: expect.any(Date) });
  });

  it("en local usa la app del 5008; si ya tenía clave, es un enlace de recuperación", async () => {
    emitirAccesoFamiliar.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u-4613", creado: false, proposito: "RECUPERACION" });
    const c = consola();
    expect(await ejecutar(["--email", CORREO], c, db, LOCAL)).toBe(0);
    expect(c.salida.texto).toContain(`http://127.0.0.1:5008/definir-clave#t=${TOKEN}`);
    expect(c.salida.texto).toMatch(/recuperaci/i);
  });

  it("nunca imprime el hash del token ni recomienda comprar o vender", async () => {
    emitirAccesoFamiliar.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u-4613", creado: true, proposito: "INICIAL" });
    const c = consola();
    await ejecutar(["--email", CORREO], c, db, LOCAL);
    const todo = `${c.salida.texto}${c.error.texto}`;
    expect(todo).not.toMatch(/[0-9a-f]{64}/);
    expect(todo).not.toMatch(/compr|vend/i);
  });

  it.each([
    ["ES_DEL_DUENO", /del dueño/],
    ["NO_EXISTE", /no hay un familiar/i],
    ["REVOCADO", /revocad/],
  ] as const)("ErrorFamiliar %s: sale con 2 y lo dice", async (codigo, mensaje) => {
    emitirAccesoFamiliar.mockRejectedValueOnce(new ErrorFamiliar(codigo));
    const c = consola();
    expect(await ejecutar(["--email", CORREO], c, db, LOCAL)).toBe(2);
    expect(c.error.texto).toMatch(mensaje);
  });
});

describe("acceso-familiar --revocar", () => {
  it("lo desactiva y dice que se cerraron sus sesiones", async () => {
    revocarFamiliar.mockResolvedValueOnce({ usuarioId: "u-4613", yaEstaba: false });
    const c = consola();
    expect(await ejecutar(["--email", CORREO, "--revocar"], c, db, LOCAL)).toBe(0);
    expect(revocarFamiliar).toHaveBeenCalledWith(db, { email: CORREO, ahora: expect.any(Date) });
    expect(c.salida.texto).toMatch(/revocado/i);
    expect(c.salida.texto).toMatch(/cerraron sus sesiones/);
    expect(emitirAccesoFamiliar).not.toHaveBeenCalled();
  });

  it("si ya estaba revocado, lo dice y sale con 0 (idempotente)", async () => {
    revocarFamiliar.mockResolvedValueOnce({ usuarioId: "u-4613", yaEstaba: true });
    const c = consola();
    expect(await ejecutar(["--revocar", "--email", CORREO], c, db, LOCAL)).toBe(0);
    expect(c.salida.texto).toMatch(/ya estaba revocado/);
  });
});

describe("acceso-familiar --reiniciar-totp", () => {
  it("reinicia el segundo factor del familiar y no emite enlace", async () => {
    reiniciarTotpFamiliar.mockResolvedValueOnce({ usuarioId: "u-4613" });
    const c = consola();
    expect(await ejecutar(["--email", CORREO, "--reiniciar-totp"], c, db, LOCAL)).toBe(0);
    expect(reiniciarTotpFamiliar).toHaveBeenCalledWith(db, { email: CORREO, ahora: expect.any(Date) });
    expect(c.salida.texto).toMatch(/30 minutos/);
    expect(c.salida.texto).not.toMatch(/definir-clave/);
  });
});

describe("acceso-familiar · lista blanca de argumentos y rol", () => {
  it.each([
    [[]],
    [["--email"]],
    [["--email", "-familiar@ejemplo.invalid"]],
    [["--email", "--revocar"]],
    [["--email", CORREO, "--revocar", "--reiniciar-totp"]],
    [["--email", CORREO, "--revocar", "--revocar"]],
    [["--email", CORREO, "--email", "otro-familiar@ejemplo.invalid"]],
    [["--email", CORREO, "--reactivar"]],
    [["--email", CORREO, "extra"]],
    [["--correo", CORREO]],
  ])("%j → 2 con el uso, sin tocar la base", async (argv) => {
    const c = consola();
    expect(await ejecutar(argv, c, db, LOCAL)).toBe(2);
    expect(c.error.texto).toContain(USO);
    expect(ninguno()).toBe(true);
  });

  it.each([[["--email", CORREO]], [["--email", CORREO, "--revocar"]], [["--email", CORREO, "--reiniciar-totp"]]])(
    "en producción, %j con otro rol que inv_dueno (p. ej. inv_app) sale con 2 y no hace nada",
    async (argv) => {
      const c = consola();
      expect(await ejecutar(argv, c, conRol("inv_app"), { NODE_ENV: "production", APP_ORIGEN: "https://inversiones.ejemplo.invalid" })).toBe(2);
      expect(c.error.texto).toMatch(/inv_dueno/);
      expect(ninguno()).toBe(true);
    },
  );

  it("un error inesperado sale con 1 y solo su código, nunca el mensaje crudo (puede traer la URL)", async () => {
    revocarFamiliar.mockRejectedValueOnce(Object.assign(new Error("postgresql://ficticio:clave-ficticia@127.0.0.1:1/x_test"), { code: "P1001" }));
    const c = consola();
    expect(await ejecutar(["--email", CORREO, "--revocar"], c, db, LOCAL)).toBe(1);
    expect(c.error.texto).toContain("P1001");
    expect(`${c.salida.texto}${c.error.texto}`).not.toMatch(/postgresql:|clave-ficticia/);
  });
});

describe("scripts/acceso-familiar.ts como proceso (sin base)", { timeout: 2 * POR_CLI_MS }, () => {
  const ENTORNO = entornoMinimo({ DATABASE_URL: "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test" });
  it("con un argumento fuera de la lista blanca sale con 2 y el uso, antes de tocar la base", () => {
    const s = correr("acceso-familiar.ts", ["--email", "--revocar"], ENTORNO);
    comprobar(s, 2, USO, ["clave-ficticia", "postgresql://"]);
    expect(s.texto).not.toContain("PrismaClient");
  });
});
