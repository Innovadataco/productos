/**
 * SPEC-129 (C1, D-a, condición O-1) — destino del logo por rol y zona.
 * SCHOOL_ADMIN → su panel SIEMPRE (también en zona pública: no reporta con su cuenta
 * institucional). Los demás roles conservan SPEC-106: zona pública → "/", zona
 * autenticada → su panel. Sin DOM: función pura exportada de NavHeader.
 */
import { describe, it, expect } from "vitest";
import { destinoLogo } from "./NavHeader";

describe("destinoLogo (SPEC-129, O-1)", () => {
    it("SCHOOL_ADMIN va a su panel en CUALQUIER zona (D-a)", () => {
        expect(destinoLogo({ rol: "SCHOOL_ADMIN" }, "/")).toBe("/dashboard/colegio");
        expect(destinoLogo({ rol: "SCHOOL_ADMIN" }, "/dashboard-publico")).toBe("/dashboard/colegio");
        expect(destinoLogo({ rol: "SCHOOL_ADMIN" }, "/seguimiento")).toBe("/dashboard/colegio");
        expect(destinoLogo({ rol: "SCHOOL_ADMIN" }, "/dashboard/colegio")).toBe("/dashboard/colegio");
        expect(destinoLogo({ rol: "SCHOOL_ADMIN" }, "/dashboard/colegio/cursos")).toBe("/dashboard/colegio");
    });

    it("roles internos en zona pública raíz siguen yendo a / (SPEC-106 intacto)", () => {
        for (const rol of ["ADMIN", "OPERADOR", "COMITE_VALIDACION"]) {
            expect(destinoLogo({ rol }, "/")).toBe("/");
            expect(destinoLogo({ rol }, "/seguimiento")).toBe("/");
            expect(destinoLogo({ rol }, "/reportar")).toBe("/");
        }
    });

    it("roles internos en /dashboard-publico: la lógica original ya los enviaba a su panel (se preserva)", () => {
        // /dashboard-publico empieza por /dashboard: la regla SPEC-106 siempre la
        // trató como zona autenticada. SPEC-404 (I-290) redirige ADMIN y
        // OPERADOR a la bandeja (URL propia); `/dashboard/admin` era aterrizaje
        // que redirigía a Inicio y dejaba el logo muerto.
        expect(destinoLogo({ rol: "ADMIN" }, "/dashboard-publico")).toBe("/dashboard/admin/bandeja");
        expect(destinoLogo({ rol: "OPERADOR" }, "/dashboard-publico")).toBe("/dashboard/admin/bandeja");
        expect(destinoLogo({ rol: "COMITE_VALIDACION" }, "/dashboard-publico")).toBe("/dashboard/admin/comite");
    });

    it("PARENT en zona pública sigue yendo a /", () => {
        expect(destinoLogo({ rol: "PARENT" }, "/")).toBe("/");
        expect(destinoLogo({ rol: "PARENT" }, "/seguimiento")).toBe("/");
    });

    it("zona autenticada: cada rol a su panel (SPEC-404: ADMIN/OPERADOR van a la bandeja)", () => {
        expect(destinoLogo({ rol: "ADMIN" }, "/dashboard/admin")).toBe("/dashboard/admin/bandeja");
        expect(destinoLogo({ rol: "OPERADOR" }, "/dashboard/admin")).toBe("/dashboard/admin/bandeja");
        expect(destinoLogo({ rol: "COMITE_VALIDACION" }, "/dashboard/admin/comite")).toBe("/dashboard/admin/comite");
        expect(destinoLogo({ rol: "PARENT" }, "/dashboard")).toBe("/dashboard");
    });

    it("sin sesión: siempre /", () => {
        expect(destinoLogo(null, "/")).toBe("/");
        expect(destinoLogo(null, "/dashboard-publico")).toBe("/");
    });
});
