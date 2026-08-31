/**
 * SPEC-319 (I-212) — tests de la fuente única rol→home.
 */
import { describe, it, expect } from "vitest";
import { homeParaRol } from "./home-para-rol";

describe("homeParaRol (SPEC-319)", () => {
    it("ADMIN → /dashboard/admin", () => {
        expect(homeParaRol("ADMIN")).toBe("/dashboard/admin");
    });

    it("OPERADOR → /dashboard/admin (unifica la contradicción previa)", () => {
        expect(homeParaRol("OPERADOR")).toBe("/dashboard/admin");
    });

    it("SCHOOL_ADMIN → /dashboard/colegio", () => {
        expect(homeParaRol("SCHOOL_ADMIN")).toBe("/dashboard/colegio");
    });

    it("COMITE_VALIDACION → /dashboard/admin/comite", () => {
        expect(homeParaRol("COMITE_VALIDACION")).toBe("/dashboard/admin/comite");
    });

    it("COMITE_CONVIVENCIA → /dashboard/colegio/comite (cierra I-212)", () => {
        expect(homeParaRol("COMITE_CONVIVENCIA")).toBe("/dashboard/colegio/comite");
    });

    it("PARENT → /dashboard/padre (Decisión A · A-54/SPEC-317)", () => {
        expect(homeParaRol("PARENT")).toBe("/dashboard/padre");
    });

    it("rol desconocido → /mis-reportes (fallback neutro sin rebote)", () => {
        expect(homeParaRol("ROL_INVENTADO")).toBe("/mis-reportes");
    });

    it("undefined → /mis-reportes (fallback neutro)", () => {
        expect(homeParaRol(undefined)).toBe("/mis-reportes");
    });
});
