/**
 * SPEC-126 (T009): fuentes estáticas del menú para la aserción B. Sin BD.
 */
import { describe, it, expect } from "vitest";
import { arraysNav, grantsSeedPorRol, parsearHeader } from "./lib/nav-fuentes";

describe("fuentes del menú (SPEC-126)", () => {
    it("el header se parsea completo: todo href literal tiene guarda y todo dinámico se resuelve", () => {
        const header = parsearHeader(); // lanza (fallo ruidoso) si algo no se resuelve
        expect(header.literales.length).toBeGreaterThan(5);
        // La guarda de /login solo lo pinta al anónimo; la de /dashboard/colegio solo a SCHOOL_ADMIN
        expect(header.hrefsPintados("ANONIMO")).toContain("/login");
        expect(header.hrefsPintados("SCHOOL_ADMIN")).toContain("/dashboard/colegio");
        expect(header.hrefsPintados("PARENT")).not.toContain("/dashboard/colegio");
    });

    it("grants del seed: COMITE_VALIDACION recibe su bandeja + denuncia formal (D-43 + 002-PI-056)", () => {
        const grants = grantsSeedPorRol();
        // Antes de D-43 tenía los 3 módulos de comité (base del hallazgo I-39); dos de
        // ellos mapean a rutas ADMIN_ONLY que la puerta le niega → default contradictorio.
        // 002-PI-056 (F2, decisión ZEUS): el comité genera denuncias formales →
        // denuncia_formal (hija de bandeja_reportes, jerarquía AND). No reabre D-43:
        // esas rutas no son ADMIN_ONLY.
        expect(grants.COMITE_VALIDACION).toEqual(["bandeja_reportes", "comite_bandeja", "denuncia_formal"]);
        expect(grants.OPERADOR).toEqual(["bandeja_reportes"]);
        expect(grants.ADMIN?.length).toBeGreaterThan(10);
    });

    it("arraysNav cubre los menús de área Y los submenús de tabs fijas (D-41)", () => {
        const nombres = arraysNav().map((n) => n.nombre);
        expect(nombres).toContain("ADMIN_NAV_ITEMS");
        expect(nombres).toContain("COMITE_NAV_TABS");
        expect(nombres).toContain("COLEGIO_NAV_ITEMS");
        expect(nombres).toContain("OperadoresSubNav.tabs");
        expect(nombres).toContain("DashboardSubNav.tabs");
        for (const nav of arraysNav()) {
            expect(nav.items.length).toBeGreaterThan(0);
        }
    });
});
