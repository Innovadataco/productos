// Tope global de ingresos (D-014, hallazgo MEDIO de security-reviewer): POST /api/sesion/ingresar y
// /api/sesion/definir-clave cuentan juntos; pasado el tope por minuto responden 429 con Retry-After,
// ANTES de gastar bcrypt. La lógica de la cuenta y de la base se simula: aquí solo importa el tope.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ingresar = vi.hoisted(() => vi.fn());
const definirClave = vi.hoisted(() => vi.fn());
vi.mock("@/auth/ingreso", () => ({ ingresar }));
vi.mock("@/auth/acceso", () => ({ definirClave }));
vi.mock("@/lib/db", () => ({ db: {} }));

const ORIGEN = "http://127.0.0.1:5008";
const pedido = (ruta: string, cuerpo: unknown, k: number) =>
  new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { origin: ORIGEN, "content-type": "application/json", "cf-connecting-ip": `198.51.100.${k % 250}` },
    body: JSON.stringify(cuerpo),
  });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("AUTH_SECRET", "secreto-ficticio-del-tope-global-0123456789");
  ingresar.mockResolvedValue({ ok: false, motivo: "CLAVE_INCORRECTA" });
  definirClave.mockResolvedValue({ ok: false, motivo: "TOKEN_INVALIDO" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("inv008.carga")];
});

describe("tope global de ingresos (60 por minuto, todas las IP juntas)", () => {
  it("el intento 61 recibe 429 con Retry-After y no llega a bcrypt; definir clave cuenta en el mismo tope", async () => {
    const { POST: entrar } = await import("@/app/api/sesion/ingresar/route");
    const { POST: definir } = await import("@/app/api/sesion/definir-clave/route");
    for (let k = 0; k < 30; k += 1) expect((await entrar(pedido("/api/sesion/ingresar", { email: "d@ejemplo.invalid", clave: "clave-ficticia-12" }, k))).status).toBe(401);
    for (let k = 30; k < 60; k += 1) expect((await definir(pedido("/api/sesion/definir-clave", { token: "t".repeat(43), clave: "clave-ficticia-12" }, k))).status).toBe(401);
    const r = await entrar(pedido("/api/sesion/ingresar", { email: "d@ejemplo.invalid", clave: "clave-ficticia-12" }, 61));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(ingresar).toHaveBeenCalledTimes(30);
    expect((await definir(pedido("/api/sesion/definir-clave", { token: "t".repeat(43), clave: "clave-ficticia-12" }, 62))).status).toBe(429);
  });
});
