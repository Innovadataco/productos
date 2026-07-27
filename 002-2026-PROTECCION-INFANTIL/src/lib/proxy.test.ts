import { describe, it, expect } from "vitest";
import { esRutaPermitidaSchoolAdmin } from "./proxy";

describe("esRutaPermitidaSchoolAdmin", () => {
    it("permite las rutas del módulo colegio", () => {
        expect(esRutaPermitidaSchoolAdmin("/dashboard/colegio")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/dashboard/colegio/cursos")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/colegio/cursos")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/me/colegio")).toBe(true);
    });

    it("permite /api/me para que el header reconozca la sesión (I-25)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/me")).toBe(true);
    });

    it("permite /cambiar-password para el cambio obligatorio de contraseña (C-9)", () => {
        expect(esRutaPermitidaSchoolAdmin("/cambiar-password")).toBe(true);
    });

    it("no confunde /api/me con rutas ajenas como /api/metricas", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/metricas")).toBe(false);
    });

    it("sigue bloqueando rutas de administración y de usuario final", () => {
        expect(esRutaPermitidaSchoolAdmin("/dashboard/admin")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/api/admin/colegios")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/dashboard")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/reportar")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/")).toBe(false);
    });
});
