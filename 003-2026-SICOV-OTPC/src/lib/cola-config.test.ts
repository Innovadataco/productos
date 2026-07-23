import { describe, it, expect, afterEach, vi } from "vitest";
import { colaMaxReintentos, colaBackoffMin, colaBackoffMs } from "./cola-config";
import { intentarEnvioInmediato } from "./envio-inmediato";

afterEach(() => vi.unstubAllEnvs());

describe("cola-config (D-019b — parametrizable por env, compartido por las 3 colas)", () => {
  it("defaults del legacy: 3 reintentos, 5 minutos", () => {
    vi.stubEnv("COLA_MAX_REINTENTOS", "");
    vi.stubEnv("COLA_BACKOFF_MIN", "");
    expect(colaMaxReintentos()).toBe(3);
    expect(colaBackoffMin()).toBe(5);
    expect(colaBackoffMs()).toBe(5 * 60_000);
  });

  it("lee overrides de env en el momento de la llamada", () => {
    vi.stubEnv("COLA_MAX_REINTENTOS", "5");
    vi.stubEnv("COLA_BACKOFF_MIN", "2");
    expect(colaMaxReintentos()).toBe(5);
    expect(colaBackoffMs()).toBe(2 * 60_000);
  });

  it("valores inválidos caen al default (nunca 0 ni negativos)", () => {
    vi.stubEnv("COLA_MAX_REINTENTOS", "0");
    vi.stubEnv("COLA_BACKOFF_MIN", "-1");
    expect(colaMaxReintentos()).toBe(3);
    expect(colaBackoffMin()).toBe(5);
    vi.stubEnv("COLA_MAX_REINTENTOS", "abc");
    expect(colaMaxReintentos()).toBe(3);
  });
});

describe("intentarEnvioInmediato (D-021 — intento síncrono con caída a cola)", () => {
  it("éxito → true", async () => {
    await expect(intentarEnvioInmediato(async () => {})).resolves.toBe(true);
  });

  it("fallo → false SIN lanzar (la solicitud queda pendiente en cola)", async () => {
    await expect(
      intentarEnvioInmediato(async () => {
        throw new Error("Super caída");
      }),
    ).resolves.toBe(false);
  });
});
