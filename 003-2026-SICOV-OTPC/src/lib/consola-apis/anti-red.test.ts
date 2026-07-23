import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/// SC-1 / guardarraíl de la consola (013): ejecutar una operación NO genera tráfico a la Super.
/// Se usa el cliente REAL (stub por el gate INTEGRACIONES_MODO=stub del entorno de test) y se
/// espía `fetch` para afirmar CERO peticiones a *.supertransporte.gov.co.

vi.mock("@/lib/prisma", () => ({
  prisma: { apiLlamada: { create: vi.fn(async () => ({ id: 1 })) } },
}));

import { ejecutarOperacion } from "./ejecutar";
import { _resetClienteSupertransporte } from "@/lib/integracion/cliente";

let fetchSpy: ReturnType<typeof vi.fn>;
const U = { id: 1, rolId: 1, identificacion: "900853057" };

beforeEach(() => {
  _resetClienteSupertransporte(); // fuerza reselección → ClienteStub (modo stub del test-setup)
  fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

describe("consola — cero red (Fase 1)", () => {
  it("ejecutar operaciones stub no contacta *.supertransporte.gov.co", async () => {
    await ejecutarOperacion("despachos", { obj_despacho: {} }, U);
    await ejecutarOperacion("maestras-rutas", { nit: "900853057" }, U);
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0] ?? "")).not.toContain("supertransporte.gov.co");
    }
  });
});
