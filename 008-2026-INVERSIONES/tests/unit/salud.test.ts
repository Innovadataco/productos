import { describe, expect, it } from "vitest";
import { evaluarSalud } from "@/lib/salud";

// /api/salud es pública (sin sesión): responde SOLO `estado` y `version` (D-014). Ni `base` ni `motivo`:
// el detalle de un fallo de la base es información de más para quien no inició sesión.
describe("evaluarSalud", () => {
  it("responde ok cuando la base contesta, con solo estado y versión", async () => {
    const salud = await evaluarSalud(async () => {}, "abc123");
    expect(salud).toEqual({ estado: "ok", version: "abc123" });
  });

  it("responde degradado con solo estado y versión, sin filtrar el error de la base", async () => {
    const salud = await evaluarSalud(async () => {
      throw new Error("connect ECONNREFUSED postgresql://usuario:clave@host:5438/inversiones");
    }, "abc123");
    expect(salud).toEqual({ estado: "degradado", version: "abc123" });
    expect(JSON.stringify(salud)).not.toContain("clave");
    expect(JSON.stringify(salud)).not.toContain("postgresql://");
  });
});
