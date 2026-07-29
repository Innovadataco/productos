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

    it("permite el endpoint /api/auth/cambiar-password que la página llama (I-35)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/auth/cambiar-password")).toBe(true);
    });

    it("permite el endpoint /api/auth/logout para salir de la pantalla (I-35b)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/auth/logout")).toBe(true);
    });

    // SPEC-118 (D-37, decisión ZEUS): el colegio PUEDE usar el área pública de
    // solo lectura. El aislamiento total no aportaba seguridad (son estadísticas
    // públicas agregadas, visibles incluso sin sesión) y creaba clics muertos.
    it("permite las rutas públicas de solo lectura (D-37)", () => {
        expect(esRutaPermitidaSchoolAdmin("/")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/dashboard-publico")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/seguimiento")).toBe(true);
    });

    it("permite las APIs públicas de solo lectura que esas pantallas consumen (D-37)", () => {
        // home "/": formulario de consulta → /api/consulta (GET/POST de consulta)
        expect(esRutaPermitidaSchoolAdmin("/api/consulta")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/consulta/detalle")).toBe(true);
        // /dashboard-publico → /api/estadisticas-publicas
        expect(esRutaPermitidaSchoolAdmin("/api/estadisticas-publicas")).toBe(true);
        // /seguimiento → /api/reportes/seguimiento/[numero] (GET, solo lectura)
        expect(esRutaPermitidaSchoolAdmin("/api/reportes/seguimiento")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/reportes/seguimiento/RPT-2026-000001")).toBe(true);
    });

    it("la raíz '/' NO abre el árbol entero por prefijo", () => {
        expect(esRutaPermitidaSchoolAdmin("/privacidad")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/login")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/x")).toBe(false);
    });

    it("no confunde /api/me con rutas ajenas como /api/metricas", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/metricas")).toBe(false);
    });

    it("sigue bloqueando rutas de administración y de usuario final", () => {
        expect(esRutaPermitidaSchoolAdmin("/dashboard/admin")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/api/admin/colegios")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/dashboard")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/mis-reportes")).toBe(false);
    });

    it("sigue bloqueando /reportar y la creación de reportes: la cuenta institucional no reporta", () => {
        expect(esRutaPermitidaSchoolAdmin("/reportar")).toBe(false);
        // Solo se abre el sub-árbol de seguimiento (GET); /api/reportes (POST de
        // creación) y el resto de sus subrutas quedan cerradas.
        expect(esRutaPermitidaSchoolAdmin("/api/reportes")).toBe(false);
    });
});
