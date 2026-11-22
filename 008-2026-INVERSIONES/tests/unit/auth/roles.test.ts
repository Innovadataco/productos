// Roles con acceso a la web (frente familia-lectura): el dueño y la familia entran; la familia, en solo lectura.
// Falla cerrada: un valor que no sea exactamente DUENO es de solo lectura, y uno que no esté en la lista no entra.
import { describe, expect, it } from "vitest";
import { ROLES_WEB, esDueno, esSoloLectura, tieneAccesoWeb } from "@/auth/roles";

describe("roles con acceso web", () => {
  it("la lista es cerrada: DUENO y FAMILIA, en ese orden", () => {
    expect(ROLES_WEB).toEqual(["DUENO", "FAMILIA"]);
  });

  it.each([
    ["DUENO", true],
    ["FAMILIA", true],
    ["dueno", false],
    ["ADMIN", false],
    ["", false],
  ])("tieneAccesoWeb(%j) = %s", (rol, esperado) => {
    expect(tieneAccesoWeb(rol)).toBe(esperado);
  });

  it.each([
    ["DUENO", true, false],
    ["FAMILIA", false, true],
    ["OTRO", false, true],
    ["", false, true],
  ])("%j: esDueno %s, esSoloLectura %s (falla cerrada)", (rol, dueno, soloLectura) => {
    expect(esDueno({ rol })).toBe(dueno);
    expect(esSoloLectura({ rol })).toBe(soloLectura);
  });
});
