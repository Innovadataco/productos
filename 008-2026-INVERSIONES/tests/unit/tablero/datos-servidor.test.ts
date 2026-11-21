// Candado de INV-SPEC-15: los datos del tablero solo se leen en el servidor.
// `datos.ts` debe cargar `server-only`, para que Next rompa el build si un componente de cliente lo importa.
import { describe, expect, it, vi } from "vitest";

const candado = vi.hoisted(() => ({ cargado: false }));

vi.mock("server-only", () => {
  candado.cargado = true;
  return {};
});

describe("src/tablero/datos.ts", () => {
  it("carga server-only al importarse: un componente de cliente no puede traerlo", async () => {
    await import("@/tablero/datos");
    expect(candado.cargado).toBe(true);
  });
});
