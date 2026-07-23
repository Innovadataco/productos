import { describe, it, expect } from "vitest";
import { CATALOGO, FASE_CONSOLA, buscarOperacion } from "./catalogo";

const EJECUTORES_VALIDOS = new Set([
  "postTransaccional",
  "postMantenimiento",
  "getMantenimiento",
  "consultarIntegradora",
  "consultarRutasActivas",
  "consultarAutorizaciones",
]);

describe("catálogo de la consola (013)", () => {
  it("el candado de fase está en 1 (Fase 1)", () => {
    expect(FASE_CONSOLA).toBe(1);
  });

  it("cada entrada declara un ejecutor válido (método real del cliente)", () => {
    for (const op of CATALOGO) {
      expect(EJECUTORES_VALIDOS.has(op.ejecutor)).toBe(true);
    }
  });

  it("las claves son únicas", () => {
    const claves = CATALOGO.map((o) => o.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("incluye las operaciones Fase 1 ejecutables (no pendientes)", () => {
    const ejecutables = CATALOGO.filter((o) => !o.pendiente).map((o) => o.clave);
    for (const c of ["despachos", "llegadas", "mantenimiento-base", "mantenimiento-preventivo", "mantenimiento-correctivo", "integradora", "maestras-rutas", "maestras-autorizaciones"]) {
      expect(ejecutables).toContain(c);
    }
  });

  it("006/007/008 aparecen como pendientes (no ejecutables)", () => {
    for (const c of ["alistamientos", "autorizaciones-nna", "novedades"]) {
      expect(buscarOperacion(c)?.pendiente).toBe(true);
    }
  });

  it("las cabeceras son solo NOMBRES (nunca valores tipo Bearer <x>)", () => {
    for (const op of CATALOGO) {
      for (const h of op.cabeceras) {
        expect(h).not.toContain(" ");
      }
    }
  });
});
