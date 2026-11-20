import { describe, expect, it } from "vitest";
import { evaluarSalud } from "@/lib/salud";

describe("evaluarSalud", () => {
  it("responde ok cuando la base contesta", async () => {
    const salud = await evaluarSalud(async () => {}, "abc123");
    expect(salud).toEqual({ estado: "ok", base: "ok", version: "abc123" });
  });

  it("responde degradado sin filtrar el error de la base (puede traer la URL con clave)", async () => {
    const salud = await evaluarSalud(async () => {
      throw new Error("connect ECONNREFUSED postgresql://usuario:clave@host:5438/inversiones");
    }, "abc123");
    expect(salud.estado).toBe("degradado");
    expect(JSON.stringify(salud)).not.toContain("clave");
    expect(JSON.stringify(salud)).not.toContain("postgresql://");
  });
});
