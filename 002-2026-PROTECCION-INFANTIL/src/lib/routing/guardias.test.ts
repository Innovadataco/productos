/**
 * SPEC-287 · Unit tests de GUARDIAS_ACCESO.
 *
 * Cobertura: invariante crítica (destino ∈ exentas), helpers puros de matching.
 */
import { describe, it, expect } from "vitest";
import {
    GUARDIAS_ACCESO,
    matcheaRuta,
    esRutaPublica,
    esRutaSesion,
    esExentaConsentimiento,
    esExentaCambiarPassword,
    esExentaVigencia,
    destinoVigencia,
    tieneVigencia,
} from "./guardias";

describe("GUARDIAS_ACCESO — invariante destino ∈ exentas", () => {
    it("consentimiento.destino aparece en consentimiento.exentas", () => {
        expect(GUARDIAS_ACCESO.consentimiento.exentas).toContain(GUARDIAS_ACCESO.consentimiento.destino);
    });

    it("cambiarPassword.destino aparece en cambiarPassword.exentas", () => {
        expect(GUARDIAS_ACCESO.cambiarPassword.exentas).toContain(GUARDIAS_ACCESO.cambiarPassword.destino);
    });

    it("por cada rol de vigencia, destino aparece en exentas", () => {
        for (const [rol, cfg] of Object.entries(GUARDIAS_ACCESO.vigencia)) {
            expect(cfg.exentas, `vigencia.${rol}.destino "${cfg.destino}" debe estar en exentas`).toContain(cfg.destino);
        }
    });
});

describe("matcheaRuta — coincidencia por segmento", () => {
    it("igualdad exacta matchea", () => {
        expect(matcheaRuta("/dashboard", "/dashboard")).toBe(true);
    });

    it("prefijo de segmento matchea", () => {
        expect(matcheaRuta("/dashboard/padre", "/dashboard")).toBe(true);
    });

    it("prefijo parcial de string NO matchea (evita /api/pagos-otros vs /api/pagos)", () => {
        expect(matcheaRuta("/api/pagos-otros", "/api/pagos")).toBe(false);
    });

    it("ruta raíz no matchea todo el árbol (\"/\" es case especial)", () => {
        expect(matcheaRuta("/dashboard", "/")).toBe(false);
    });
});

describe("esRutaPublica", () => {
    it("clasifica login, registro, home como públicas", () => {
        expect(esRutaPublica("/login")).toBe(true);
        expect(esRutaPublica("/registro-colegio")).toBe(true);
        expect(esRutaPublica("/")).toBe(true);
    });

    it("clasifica dashboard como NO pública", () => {
        expect(esRutaPublica("/dashboard/padre")).toBe(false);
    });

    it("clasifica /consulta como NO pública (retirada por SPEC-286)", () => {
        expect(esRutaPublica("/consulta")).toBe(false);
    });
});

describe("esRutaSesion", () => {
    it("clasifica /consentimiento como sesión", () => {
        expect(esRutaSesion("/consentimiento")).toBe(true);
    });

    it("clasifica /api/vigencia/refresh como sesión (SPEC-287)", () => {
        expect(esRutaSesion("/api/vigencia/refresh")).toBe(true);
    });

    it("clasifica /dashboard/padre como NO sesión (necesita más gates)", () => {
        expect(esRutaSesion("/dashboard/padre")).toBe(false);
    });
});

describe("esExentaConsentimiento y esExentaCambiarPassword", () => {
    it("consentimiento.destino queda exenta de su propio muro", () => {
        expect(esExentaConsentimiento("/consentimiento")).toBe(true);
    });

    it("cambiarPassword.destino queda exenta de su propio muro", () => {
        expect(esExentaCambiarPassword("/cambiar-password")).toBe(true);
    });

    it("una ruta cualquiera NO está exenta de consentimiento", () => {
        expect(esExentaConsentimiento("/dashboard/padre")).toBe(false);
    });
});

describe("tieneVigencia y esExentaVigencia", () => {
    it("PARENT y SCHOOL_ADMIN y COMITE_CONVIVENCIA tienen guardián de vigencia", () => {
        expect(tieneVigencia("PARENT")).toBe(true);
        expect(tieneVigencia("SCHOOL_ADMIN")).toBe(true);
        expect(tieneVigencia("COMITE_CONVIVENCIA")).toBe(true);
    });

    it("ADMIN y OPERADOR NO tienen guardián de vigencia", () => {
        expect(tieneVigencia("ADMIN")).toBe(false);
        expect(tieneVigencia("OPERADOR")).toBe(false);
        expect(tieneVigencia(null)).toBe(false);
        expect(tieneVigencia(undefined)).toBe(false);
    });

    it("para PARENT, /dashboard/padre/suscripcion está exenta (destino)", () => {
        expect(esExentaVigencia("/dashboard/padre/suscripcion", "PARENT")).toBe(true);
    });

    it("para SCHOOL_ADMIN, /dashboard/colegio/suscripcion está exenta", () => {
        expect(esExentaVigencia("/dashboard/colegio/suscripcion", "SCHOOL_ADMIN")).toBe(true);
    });

    it("para PARENT, /dashboard/padre NO está exenta", () => {
        expect(esExentaVigencia("/dashboard/padre", "PARENT")).toBe(false);
    });

    it("destinoVigencia devuelve la URL configurada por rol", () => {
        expect(destinoVigencia("PARENT")).toBe("/dashboard/padre/suscripcion");
        expect(destinoVigencia("SCHOOL_ADMIN")).toBe("/dashboard/colegio/suscripcion");
    });
});
