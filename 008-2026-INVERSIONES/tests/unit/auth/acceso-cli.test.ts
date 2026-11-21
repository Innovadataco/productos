// `scripts/crear-acceso-inicial.ts` (D-014): crea el dueño sin contraseña (o reutiliza el que hay) e
// imprime UNA vez el enlace de un solo uso, con el token en el fragmento. Sirve también para recuperar.
import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const emitirAcceso = vi.hoisted(() => vi.fn());
const reiniciarTotp = vi.hoisted(() => vi.fn());
vi.mock("@/auth/acceso", async (original) => ({ ...(await original<typeof import("@/auth/acceso")>()), emitirAcceso }));
vi.mock("@/auth/reinicio-totp", () => ({ reiniciarTotp }));

import { ErrorAcceso } from "@/auth/acceso";
import { ejecutar } from "@/auth/acceso-cli";

/** Token inventado para la prueba. */
const TOKEN = "t".repeat(43);
const db = {} as never;

class Salida extends Writable {
  texto = "";
  override _write(trozo: Buffer, _codificacion: BufferEncoding, listo: () => void): void {
    this.texto += trozo.toString("utf8");
    listo();
  }
}

const consola = () => ({ salida: new Salida(), error: new Salida() });

afterEach(() => {
  emitirAcceso.mockReset();
  reiniciarTotp.mockReset();
});

describe("crear-acceso-inicial", () => {
  it("en producción imprime una vez APP_ORIGEN/definir-clave#t=<token>", async () => {
    emitirAcceso.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u1", creado: true, proposito: "INICIAL" });
    const c = consola();
    const env = { NODE_ENV: "production", APP_ORIGEN: "https://inversiones.innovadataco.com" };
    expect(await ejecutar(["--email", "dueno@ejemplo.invalid"], c, db, env)).toBe(0);
    const url = `https://inversiones.innovadataco.com/definir-clave#t=${TOKEN}&u=dueno%40ejemplo.invalid`;
    expect(c.salida.texto.split(url)).toHaveLength(2);
    expect(c.salida.texto).toMatch(/30 minutos/);
    expect(c.salida.texto).toMatch(/un solo uso/);
    expect(emitirAcceso).toHaveBeenCalledWith(db, { email: "dueno@ejemplo.invalid", ahora: expect.any(Date) });
  });

  it("en local usa la app del 5008", async () => {
    emitirAcceso.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u1", creado: false, proposito: "RECUPERACION" });
    const c = consola();
    expect(await ejecutar(["--email", "dueno@ejemplo.invalid"], c, db, { NODE_ENV: "development" })).toBe(0);
    expect(c.salida.texto).toContain(`http://127.0.0.1:5008/definir-clave#t=${TOKEN}`);
    expect(c.salida.texto).toMatch(/recuperaci/i);
  });

  it("nunca imprime el hash del token", async () => {
    emitirAcceso.mockResolvedValueOnce({ token: TOKEN, usuarioId: "u1", creado: true, proposito: "INICIAL" });
    const c = consola();
    await ejecutar(["--email", "dueno@ejemplo.invalid"], c, db, { NODE_ENV: "development" });
    expect(`${c.salida.texto}${c.error.texto}`).not.toMatch(/[0-9a-f]{64}/);
  });

  it("en producción sin APP_ORIGEN sale con 2 y no crea nada", async () => {
    const c = consola();
    expect(await ejecutar(["--email", "dueno@ejemplo.invalid"], c, db, { NODE_ENV: "production" })).toBe(2);
    expect(emitirAcceso).not.toHaveBeenCalled();
    expect(c.error.texto).toMatch(/APP_ORIGEN/);
  });

  it("sin --email, con un correo inválido o con opciones de más sale con 2 y muestra el uso", async () => {
    for (const argv of [[], ["--email", "no-es-correo"], ["--email", "d@ejemplo.invalid", "--clave", "x"]]) {
      const c = consola();
      expect(await ejecutar(argv, c, db, { NODE_ENV: "development" }), argv.join(" ")).toBe(2);
      expect(c.error.texto).toMatch(/Uso:/);
    }
    expect(emitirAcceso).not.toHaveBeenCalled();
  });

  it("si ya hay otro dueño, sale con 2 y lo dice", async () => {
    emitirAcceso.mockRejectedValueOnce(new ErrorAcceso("OTRO_DUENO"));
    const c = consola();
    expect(await ejecutar(["--email", "otro@ejemplo.invalid"], c, db, { NODE_ENV: "development" })).toBe(2);
    expect(c.error.texto).toMatch(/otro correo/);
  });

  it("un error inesperado sale con 1 y solo su código (nunca el mensaje crudo)", async () => {
    emitirAcceso.mockRejectedValueOnce(Object.assign(new Error("postgresql://usuario:clave@host/base"), { code: "P1001" }));
    const c = consola();
    expect(await ejecutar(["--email", "d@ejemplo.invalid"], c, db, { NODE_ENV: "development" })).toBe(1);
    expect(c.error.texto).toContain("P1001");
    expect(c.error.texto).not.toContain("postgresql://");
  });
});

describe("crear-acceso-inicial --reiniciar-totp (recuperación total del segundo factor)", () => {
  it.each([
    [["--email", "dueno@ejemplo.invalid", "--reiniciar-totp"]],
    [["--reiniciar-totp", "--email", "dueno@ejemplo.invalid"]],
  ])("con %j reinicia el TOTP de esa cuenta, no emite enlace y dice qué sigue", async (argv) => {
    reiniciarTotp.mockResolvedValueOnce({ usuarioId: "u1" });
    const c = consola();
    expect(await ejecutar(argv, c, db, { NODE_ENV: "development" })).toBe(0);
    expect(reiniciarTotp).toHaveBeenCalledWith(db, { email: "dueno@ejemplo.invalid", ahora: expect.any(Date) });
    expect(emitirAcceso).not.toHaveBeenCalled();
    expect(c.salida.texto).toMatch(/reinici/i);
    expect(c.salida.texto).toMatch(/30 minutos/);
    expect(c.salida.texto).toMatch(/sesiones/);
  });

  it("sin --email, con la bandera repetida o con otra bandera sale con 2 y muestra el uso", async () => {
    for (const argv of [["--reiniciar-totp"], ["--email", "d@ejemplo.invalid", "--reiniciar-totp", "--reiniciar-totp"], ["--email", "d@ejemplo.invalid", "--reiniciar"]]) {
      const c = consola();
      expect(await ejecutar(argv, c, db, { NODE_ENV: "development" }), argv.join(" ")).toBe(2);
      expect(c.error.texto).toMatch(/Uso:/);
      expect(c.error.texto).toMatch(/--reiniciar-totp/);
    }
    expect(reiniciarTotp).not.toHaveBeenCalled();
  });

  it("si no hay una cuenta con ese correo, sale con 2 y lo dice", async () => {
    reiniciarTotp.mockRejectedValueOnce(new ErrorAcceso("NO_EXISTE"));
    const c = consola();
    expect(await ejecutar(["--email", "nadie@ejemplo.invalid", "--reiniciar-totp"], c, db, { NODE_ENV: "development" })).toBe(2);
    expect(c.error.texto).toMatch(/no hay una cuenta/i);
  });

  /** Una base falsa que solo responde quién es el rol conectado. */
  const conRol = (rol: string) => ({ $queryRaw: vi.fn().mockResolvedValue([{ rol }]) }) as never;

  it("en producción no necesita APP_ORIGEN (no imprime enlace) y corre con el rol inv_dueno", async () => {
    reiniciarTotp.mockResolvedValueOnce({ usuarioId: "u1" });
    const c = consola();
    const base = conRol("inv_dueno");
    expect(await ejecutar(["--email", "dueno@ejemplo.invalid", "--reiniciar-totp"], c, base, { NODE_ENV: "production" })).toBe(0);
    expect(reiniciarTotp).toHaveBeenCalledWith(base, expect.anything());
  });

  it("en producción, con otro rol que inv_dueno (p. ej. inv_app), sale con 2 y no reinicia", async () => {
    const c = consola();
    expect(await ejecutar(["--email", "dueno@ejemplo.invalid", "--reiniciar-totp"], c, conRol("inv_app"), { NODE_ENV: "production" })).toBe(2);
    expect(c.error.texto).toMatch(/inv_dueno/);
    expect(reiniciarTotp).not.toHaveBeenCalled();
  });
});
