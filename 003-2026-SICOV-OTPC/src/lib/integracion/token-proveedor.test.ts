import { describe, it, expect, beforeEach } from "vitest";
import {
  getTokenProveedor,
  tokenProveedorVigente,
  clearTokenProveedor,
} from "@/lib/integracion/token-proveedor";

// Modo stub por defecto (.env.test): NUNCA toca la red.
beforeEach(() => clearTokenProveedor());

describe("TokenProveedorStore (modo stub)", () => {
  it("obtiene un token stub y queda vigente", async () => {
    expect(tokenProveedorVigente()).toBe(false);
    const token = await getTokenProveedor();
    expect(token).toMatch(/^stub-token-/);
    expect(tokenProveedorVigente()).toBe(true);
  });

  it("reutiliza el token vigente en llamadas sucesivas (SC-004)", async () => {
    const t1 = await getTokenProveedor();
    const t2 = await getTokenProveedor();
    expect(t2).toBe(t1);
  });

  it("clear fuerza un nuevo refresh", async () => {
    const t1 = await getTokenProveedor();
    clearTokenProveedor();
    expect(tokenProveedorVigente()).toBe(false);
    const t2 = await getTokenProveedor();
    expect(t2).toMatch(/^stub-token-/);
  });
});
