/**
 * CANDADO (B) · SPEC-744 · `navParaRol` es la fuente única CORRECTA.
 *
 * Prueba la fuente misma: cada rol devuelve su lista con su compuerta (módulo /
 * estado / proxy). Las capas (A) —propagación por centinela en cada superficie— y
 * (C) —barrido anti-quemado por descubridor— viven en
 * `nav-superficie-unica.candado.test.tsx`. Este candado garantiza que lo que la
 * fuente sirve es lo correcto; aquel, que cada superficie sirve lo de la fuente.
 *
 * Las expectativas se DERIVAN de las listas de `@/lib/nav-items` (no se copian a
 * mano) para no volverse una segunda lista que se desincroniza — el pecado que
 * SPEC-744 vino a cerrar.
 */
import { describe, it, expect } from "vitest";
import {
    ADMIN_NAV_ITEMS,
    COLEGIO_NAV_ITEMS,
    COMITE_COLEGIO_NAV_ITEMS,
    PADRE_NAV_ITEMS,
    ANONIMO_NAV_ITEMS,
} from "@/lib/nav-items";
import { navParaRol, aplanar } from "./para-rol";

describe("navParaRol · anónimo (sin sesión)", () => {
    it("devuelve la superficie pública (Estadísticas públicas → /dashboard-publico)", () => {
        for (const anon of [navParaRol(null), navParaRol(undefined)]) {
            // iconKey por defecto = href (contrato SPEC-744).
            expect(anon).toEqual(ANONIMO_NAV_ITEMS.map((i) => ({ href: i.href, label: i.label, iconKey: i.href })));
        }
        expect(navParaRol(null).some((e) => e.href === "/dashboard-publico")).toBe(true);
    });
});

describe("navParaRol · PARENT (sin compuerta de módulo)", () => {
    it("devuelve TODO PADRE_NAV_ITEMS (mismos href/label/estructura de hijos), sin depender de módulos", () => {
        const conModulos = navParaRol("PARENT", { modulosPermitidos: [] });
        const sinCtx = navParaRol("PARENT");
        // No lo filtra el módulo: con o sin módulos, la lista es la misma y completa.
        expect(conModulos).toEqual(sinCtx);
        expect(conModulos.map((e) => e.href)).toEqual(PADRE_NAV_ITEMS.map((i) => i.href));
        expect(conModulos.map((e) => e.label)).toEqual(PADRE_NAV_ITEMS.map((i) => i.label));
        // Los grupos conservan sus hijos.
        const reportar = conModulos.find((e) => e.label === "Reportar");
        expect(reportar?.children?.map((c) => c.href)).toEqual([
            "/dashboard/padre/reportar",
            "/dashboard/padre/expedientes",
        ]);
    });

    it("`aplanar` reproduce la barra móvil: los grupos aportan sus hijos, no la etiqueta «#»", () => {
        const plano = aplanar(navParaRol("PARENT"));
        // Ningún «#» sobrevive al aplanado.
        expect(plano.some((e) => e.href === "#")).toBe(false);
        // Y aparecen los hijos directos.
        expect(plano.some((e) => e.href === "/dashboard/padre/reportar")).toBe(true);
        expect(plano.some((e) => e.href === "/dashboard/padre/citas")).toBe(true);
    });
});

describe("navParaRol · PROFESIONAL (compuerta por estado)", () => {
    it("habilitado → menú verificado (Inicio/Casos/Calendario/Mi perfil)", () => {
        const hrefs = navParaRol("PROFESIONAL", { profesional: { habilitado: true } }).map((e) => e.href);
        expect(hrefs).toEqual([
            "/dashboard/profesional",
            "/dashboard/profesional/casos",
            "/dashboard/profesional/calendario",
            "/dashboard/profesional/mi-perfil",
        ]);
    });

    it("no habilitado → portero (solo «Mi ficha»)", () => {
        const noHab = navParaRol("PROFESIONAL", { profesional: { habilitado: false } });
        const ausente = navParaRol("PROFESIONAL", {});
        expect(noHab.map((e) => e.href)).toEqual(["/perfil-profesional/completar"]);
        expect(ausente.map((e) => e.href)).toEqual(["/perfil-profesional/completar"]); // fail-closed
    });

    it("en el muro de aceptación colapsa a portero aunque esté habilitado", () => {
        const enMuro = navParaRol("PROFESIONAL", {
            profesional: { habilitado: true },
            pathname: "/perfil-profesional/autorizacion",
        });
        expect(enMuro.map((e) => e.href)).toEqual(["/perfil-profesional/completar"]);
    });
});

describe("navParaRol · roles internos (compuerta por módulo ∧ proxy)", () => {
    it("ADMIN: solo los ítems cuyo módulo está concedido, en orden de la lista", () => {
        const dos = navParaRol("ADMIN", { modulosPermitidos: ["inicio_admin", "bandeja_reportes"] });
        expect(dos.map((e) => e.href)).toEqual([
            "/dashboard/admin/inicio",
            "/dashboard/admin/bandeja",
        ]);
        // Sin módulos, nada.
        expect(navParaRol("ADMIN", { modulosPermitidos: [] })).toEqual([]);
        // Un módulo no concedido no aparece.
        expect(
            navParaRol("ADMIN", { modulosPermitidos: ["inicio_admin"] }).some(
                (e) => e.href === "/dashboard/admin/configuracion",
            ),
        ).toBe(false);
    });

    it("ADMIN con TODOS los módulos: la lista completa alcanzable (paridad con ADMIN_NAV_ITEMS)", () => {
        const todos = [...new Set(ADMIN_NAV_ITEMS.map((i) => i.modulo))];
        const salida = navParaRol("ADMIN", { modulosPermitidos: todos }).map((e) => e.href);
        // ADMIN puede con todas las rutas admin (proxy no le niega ninguna): sale todo.
        expect(salida).toEqual(ADMIN_NAV_ITEMS.map((i) => i.href));
    });
});

describe("navParaRol · colegio (grupos con hijos)", () => {
    it("SCHOOL_ADMIN: el grupo «Usuarios» filtra sus hijos por módulo y se oculta si queda vacío", () => {
        // Solo `colegios_gestion`: el padre «Usuarios» se muestra; de sus hijos solo
        // «Profesores» (colegios_gestion); «Comité de convivencia» (colegios_comite) cae.
        const salida = navParaRol("SCHOOL_ADMIN", { modulosPermitidos: ["colegios_gestion"] });
        const usuarios = salida.find((e) => e.label === "Usuarios");
        expect(usuarios, "el grupo Usuarios debe verse con colegios_gestion").toBeTruthy();
        expect(usuarios?.children?.map((c) => c.href)).toEqual(["/dashboard/colegio/profesores"]);

        // Sin ningún módulo del colegio: nada, ni el grupo.
        expect(navParaRol("SCHOOL_ADMIN", { modulosPermitidos: [] })).toEqual([]);
    });

    it("COMITE_CONVIVENCIA: usa su lista reducida, no la del rector", () => {
        const modulos = [...new Set(COMITE_COLEGIO_NAV_ITEMS.map((i) => i.modulo))];
        const salida = navParaRol("COMITE_CONVIVENCIA", { modulosPermitidos: modulos }).map((e) => e.href);
        // Todos sus ítems son de COMITE_COLEGIO_NAV_ITEMS (subconjunto), ninguno del rector-only.
        for (const href of salida) {
            expect(COMITE_COLEGIO_NAV_ITEMS.some((i) => i.href === href)).toBe(true);
        }
        expect(salida.length).toBeGreaterThan(0);
    });
});

describe("navParaRol · higiene del contrato", () => {
    it("nunca fuga el campo `modulo`; expone iconKey (por defecto href) + labelCorto? + children", () => {
        const muestras = [
            ...navParaRol("ADMIN", { modulosPermitidos: [...new Set(ADMIN_NAV_ITEMS.map((i) => i.modulo))] }),
            ...navParaRol("SCHOOL_ADMIN", { modulosPermitidos: [...new Set(COLEGIO_NAV_ITEMS.map((i) => i.modulo))] }),
            ...navParaRol("PARENT"),
            ...navParaRol(null),
        ];
        for (const e of muestras) {
            expect(e).not.toHaveProperty("modulo");
            expect(typeof e.href).toBe("string");
            expect(typeof e.label).toBe("string");
            // iconKey siempre presente; por defecto = href (contrato SPEC-744 con Dev 1).
            expect(e.iconKey).toBe(e.href);
        }
    });
});
