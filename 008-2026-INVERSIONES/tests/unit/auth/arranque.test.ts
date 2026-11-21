// Falla cerrada al arrancar (D-014): `instrumentation.ts` corre al iniciar el servidor (no en
// `next build`) y, sin un secreto de sesión válido, o en producción sin APP_ORIGEN, la app no arranca.
// Next solo registra el error de `register()` y deja el servidor escuchando (verificado con el
// standalone: respondía 500 a todo), así que `register()` termina el proceso con código 1.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/** Secreto inventado para la prueba. */
const SECRETO = "secreto-ficticio-de-arranque-0123456789";

let salida: MockInstance;
let registro: MockInstance;

async function register(): Promise<void> {
  const modulo = await import("@/instrumentation");
  return modulo.register();
}

/** No arranca: registra qué falta (nunca el valor) y termina el proceso con código 1. */
async function noArranca(patron: RegExp): Promise<void> {
  await expect(register()).rejects.toThrow(/process\.exit\(1\)/);
  expect(salida).toHaveBeenCalledWith(1);
  expect(String(registro.mock.calls[0]?.[0])).toMatch(patron);
}

beforeEach(() => {
  vi.resetModules();
  salida = vi.spyOn(process, "exit").mockImplementation((codigo) => {
    throw new Error(`process.exit(${String(codigo)})`);
  });
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("AUTH_SECRET_FILE", "");
  vi.stubEnv("APP_ORIGEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register (instrumentation.ts)", () => {
  it.each(["production", "development"])("con NODE_ENV=%s y sin AUTH_SECRET, no arranca", async (entorno) => {
    vi.stubEnv("NODE_ENV", entorno);
    vi.stubEnv("AUTH_SECRET", "");
    await noArranca(/AUTH_SECRET/);
  });

  it("con un secreto de menos de 32 bytes, no arranca", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "corto");
    await noArranca(/32 bytes/);
    expect(JSON.stringify(registro.mock.calls)).not.toContain("corto");
  });

  it("en producción con el secreto de ejemplo de .env.example, no arranca", async () => {
    const { SECRETO_DE_EJEMPLO } = await import("@/auth/secreto");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", SECRETO_DE_EJEMPLO);
    vi.stubEnv("APP_ORIGEN", "https://inversiones.innovadataco.com");
    await noArranca(/ejemplo/);
  });

  it("en producción sin APP_ORIGEN, no arranca", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", SECRETO);
    await noArranca(/APP_ORIGEN/);
  });

  it("en producción con secreto y APP_ORIGEN válidos, arranca", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", SECRETO);
    vi.stubEnv("APP_ORIGEN", "https://inversiones.innovadataco.com");
    await expect(register()).resolves.toBeUndefined();
    expect(salida).not.toHaveBeenCalled();
  });

  it("en desarrollo basta el secreto (APP_ORIGEN no hace falta)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", SECRETO);
    await expect(register()).resolves.toBeUndefined();
  });
});
