// Candado (frente graficas-tablero): el lector de la evolución solo corre en el servidor, como datos.ts.
import { describe, expect, it, vi } from "vitest";

const candado = vi.hoisted(() => ({ cargado: false }));

vi.mock("server-only", () => {
  candado.cargado = true;
  return {};
});

describe("src/tablero/datos-evolucion.ts", () => {
  it("carga server-only al importarse: un componente de cliente no puede traerlo", async () => {
    await import("@/tablero/datos-evolucion");
    expect(candado.cargado).toBe(true);
  });
});
