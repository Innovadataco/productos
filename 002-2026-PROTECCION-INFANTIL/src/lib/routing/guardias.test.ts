/**
 * SPEC-287 · Unit tests de GUARDIAS_ACCESO.
 *
 * Cobertura: invariante crítica (destino ∈ exentas), helpers puros de matching.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    GUARDIAS_ACCESO,
    matcheaRuta,
    esRutaPublica,
    esRutaSesion,
    esExentaConsentimiento,
    esExentaCambiarPassword,
    esExentaCamino,
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

// SPEC-346 (I-234 · recorrido en vivo 340): el sello del PDF exige que
// /api/publico/** y /verificar/** sean alcanzables SIN JWT. Sin este candado,
// una autoridad no puede verificar el documento.
describe("SPEC-346 · rutas del sello público del PDF", () => {
    it("/api/publico/verificar-pdf/<hash> es pública (sin auth)", () => {
        expect(esRutaPublica("/api/publico/verificar-pdf/abc123")).toBe(true);
    });

    it("/api/publico/guia-accion/categoria/<cat> es pública", () => {
        expect(esRutaPublica("/api/publico/guia-accion/categoria/CONTACTO_INSISTENTE")).toBe(true);
    });

    it("/verificar/<codigo> es pública (la página del sello)", () => {
        expect(esRutaPublica("/verificar/abc123def")).toBe(true);
    });

    it("guard negativo — /api/padre/foo NO es pública", () => {
        expect(esRutaPublica("/api/padre/foo")).toBe(false);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SPEC-344 (A-69 · C1) — exenciones del camino del colegio + invariante cruzada
// generalizada por rol. La invariante corre al IMPORT del módulo (si alguien
// quita una exención, TODA la suite revienta al cargar); estos casos blindan
// además las decisiones concretas contra ediciones accidentales.
// ────────────────────────────────────────────────────────────────────────────
describe("SPEC-344 · camino del colegio (esExentaCamino por rol)", () => {
    it("las rutas del camino colegio están exentas PARA SCHOOL_ADMIN", () => {
        for (const ruta of [
            "/camino/colegio/rector",
            "/api/colegio/suscripcion/activar-freemium",
            "/api/colegio/carga-profesores/validar",
            "/dashboard/colegio/cursos/unificado",
            "/reportar",
            "/api/sesion/al-dia",
        ]) {
            expect(esExentaCamino(ruta, "SCHOOL_ADMIN"), `${ruta} debería estar exenta`).toBe(true);
        }
    });

    it("los módulos del colegio NO están exentos para SCHOOL_ADMIN (el guardián los tapa)", () => {
        for (const ruta of ["/dashboard/colegio", "/dashboard/colegio/tablero", "/api/colegio/estadisticas"]) {
            expect(esExentaCamino(ruta, "SCHOOL_ADMIN"), `${ruta} NO debería estar exenta`).toBe(false);
        }
    });

    it("sin rol (callers legacy) usa la lista del padre — comportamiento SPEC-339 intacto", () => {
        expect(esExentaCamino("/api/padre/hijos")).toBe(true);
        expect(esExentaCamino("/api/colegio/profesores")).toBe(false);
    });

    it("vigencia.SCHOOL_ADMIN.exentas cubre TODOS los destinos del camino colegio (anti-bucle I-25/I-111/I-141)", () => {
        for (const destino of [
            "/camino/colegio",
            "/api/colegio/rector",
            "/api/colegio/suscripcion",
            "/api/colegio/profesores",
            "/api/colegio/cursos",
            "/api/colegio/alumnos",
        ]) {
            expect(esExentaVigencia(destino, "SCHOOL_ADMIN"), `${destino} sin exención de vigencia = bucle`).toBe(true);
        }
    });
});

/**
 * SPEC-422 (I-297) · **toda puerta de registro tiene que ser pública, y las
 * futuras también.**
 *
 * Tercera aparición de la misma clase en un día: I-289 (webhook fuera de la
 * allowlist), I-290 (ítem de menú que rebotaba) y esta — `/registro-profesional`
 * existía, la tarjeta apuntaba bien, y el middleware la cortaba con 307 → /login.
 * Nadie podía inscribirse como psicólogo.
 *
 * Por eso este candado **no lista las tres puertas a mano: las descubre en el
 * disco**. El día que nazca `/registro-<loquesea>` con su `page.tsx`, este test
 * la exige en `publicas` sin que nadie se acuerde de venir a agregarla. Un
 * candado escrito a mano solo protege lo que ya se rompió; este protege la
 * cuarta puerta.
 */
describe("SPEC-422 (I-297) · las puertas de registro son públicas", () => {
    const RAIZ_APP = path.resolve(__dirname, "../../app");

    /** Directorios `src/app/registro*` que son páginas de verdad. */
    const puertas = fs
        .readdirSync(RAIZ_APP, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith("registro"))
        .filter((e) => fs.existsSync(path.join(RAIZ_APP, e.name, "page.tsx")))
        .map((e) => `/${e.name}`)
        .sort();

    it("hay al menos las tres puertas conocidas (padre, colegio, profesional)", () => {
        expect(puertas).toEqual(
            expect.arrayContaining(["/registro", "/registro-colegio", "/registro-profesional"]),
        );
    });

    it("cada puerta encontrada en el disco es alcanzable sin sesión", () => {
        const cerradas = puertas.filter((p) => !esRutaPublica(p));
        expect(
            cerradas,
            `puertas de registro que rebotan al login: ${cerradas.join(", ")}. ` +
            "Agregalas a GUARDIAS_ACCESO.publicas — una puerta de registro que exige sesión es un enlace muerto (I-297).",
        ).toEqual([]);
    });

    it("el enlace del correo (`/crear-clave/<token>`) también es alcanzable", () => {
        // Si rebota, el enlace del correo es tan muerto como la tarjeta.
        const cerradas = puertas.filter((p) => !esRutaPublica(`${p}/crear-clave/tok`));
        expect(cerradas, `enlaces de correo que rebotan: ${cerradas.join(", ")}`).toEqual([]);
    });

    it("cada puerta está por su cuenta: `/registro` NO cubre a las otras", () => {
        // La trampa exacta que causó I-297: `matcheaRuta` es prefijo POR SEGMENTO.
        expect(matcheaRuta("/registro-profesional", "/registro")).toBe(false);
        expect(matcheaRuta("/registro-colegio", "/registro")).toBe(false);
    });

    it("el candado detecta una puerta ausente (contraprueba)", () => {
        // Sin esto, un `esRutaPublica` que devolviera siempre true dejaría el
        // test en verde para siempre.
        expect(esRutaPublica("/registro-inventado")).toBe(false);
    });
});
