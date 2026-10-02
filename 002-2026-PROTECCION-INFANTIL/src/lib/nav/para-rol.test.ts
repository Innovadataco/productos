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
    PRINCIPALES_MOVIL,
} from "@/lib/nav-items";
import { navParaRol, aplanar, navMovilParaRol } from "./para-rol";

// Todos los módulos de una lista (incl. hijos) — para simular un rol con acceso completo.
const modsDe = (items: Array<{ modulo?: string; children?: Array<{ modulo?: string }> }>): string[] => [
    ...new Set(
        items.flatMap((i) => [i.modulo, ...((i.children ?? []).map((c) => c.modulo))]).filter((m): m is string => !!m),
    ),
];
const MODS_ADMIN = modsDe(ADMIN_NAV_ITEMS);
const MODS_COLEGIO = modsDe(COLEGIO_NAV_ITEMS);
const MODS_COMITE_COLEGIO = modsDe(COMITE_COLEGIO_NAV_ITEMS);
const ctxDe = (rol: string) => {
    if (rol === "PROFESIONAL") return { profesional: { estado: "ACTIVO", habilitado: true } };
    if (rol === "SCHOOL_ADMIN") return { modulosPermitidos: MODS_COLEGIO };
    if (rol === "COMITE_CONVIVENCIA") return { modulosPermitidos: MODS_COMITE_COLEGIO };
    if (rol === "PARENT") return {};
    return { modulosPermitidos: MODS_ADMIN };
};

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
    it("ADMIN: solo los ítems cuyo módulo está concedido; las hojas se agrupan en su MÓDULO (SPEC-857)", () => {
        const dos = navParaRol("ADMIN", { modulosPermitidos: ["inicio_admin", "bandeja_reportes"] });
        // «Inicio» (hoja suelta) + el MÓDULO «Reportes» (grupo href "#") con su único hijo concedido.
        expect(dos.map((e) => e.href)).toEqual(["/dashboard/admin/inicio", "#"]);
        const reportes = dos.find((e) => e.label === "Reportes");
        expect(reportes?.children?.map((c) => c.href)).toEqual(["/dashboard/admin/bandeja"]);
        // SPEC-857: ningún ENCABEZADO huérfano — las secciones de abajo no tienen ítems visibles.
        expect(dos.some((e) => e.esEncabezado)).toBe(false);
        // Sin módulos, nada.
        expect(navParaRol("ADMIN", { modulosPermitidos: [] })).toEqual([]);
        // Un módulo no concedido no muestra su grupo (Configuración es un MÓDULO).
        expect(
            navParaRol("ADMIN", { modulosPermitidos: ["inicio_admin"] }).some((e) => e.label === "Configuración"),
        ).toBe(false);
    });

    it("ADMIN con TODOS los módulos: la lista completa alcanzable (paridad con ADMIN_NAV_ITEMS)", () => {
        const todos = MODS_ADMIN; // SPEC-857: incluye los módulos de los HIJOS (modsDe aplana los grupos)
        const salida = navParaRol("ADMIN", { modulosPermitidos: todos }).map((e) => e.href);
        // ADMIN puede con todas las rutas admin (proxy no le niega ninguna): sale todo.
        expect(salida).toEqual(ADMIN_NAV_ITEMS.map((i) => i.href));
    });

    // SPEC-857 · CANDADO (control positivo del inverso): un grupo NO esconde un hijo que el rol SÍ
    // alcanza por el módulo del PROPIO hijo. La compuerta del contenedor es por HIJOS, no por el
    // módulo representativo del grupo. Muere por mutación: si alguien reintroduce
    // `permitidos.has(grupo.modulo)` en la condición del grupo, conceder solo el módulo del hijo
    // divergente dejaría el ítem fuera del menú aunque la página abra (costura entre dos candados /
    // gate con alcance corto). Alcance: SOLO hijos de grupos de nav (no «toda página alcanzable está
    // en el menú» — hay drill-downs fuera de menú a propósito).
    it("un grupo pinta un hijo divergente aunque el rol NO tenga el módulo representativo del grupo", () => {
        // Operadores: grupo=`operadores`, pero «Auditoría» la gatea `audit_logs`. Con SOLO audit_logs
        // (sin operadores) el grupo debe verse con «Auditoría» dentro.
        const soloAudit = navParaRol("ADMIN", { modulosPermitidos: ["audit_logs"] });
        const operadores = soloAudit.find((e) => e.label === "Operadores");
        expect(operadores, "el grupo Operadores debe verse con solo audit_logs (hijo divergente)").toBeTruthy();
        expect(operadores?.children?.map((c) => c.href)).toEqual(["/dashboard/admin/operadores/auditoria"]);
        // Mismo patrón en otro grupo de módulos mixtos: Estadísticas con SOLO pagos_admin pinta
        // «Dinero vs valor» (gate del hijo = pagos_admin ≠ estadisticas del grupo).
        const soloPagos = navParaRol("ADMIN", { modulosPermitidos: ["pagos_admin"] });
        const estad = soloPagos.find((e) => e.label === "Estadísticas");
        expect(estad?.children?.map((c) => c.href)).toContain("/dashboard/admin/estadisticas/dinero-vs-valor");
        // CONTROL del no-fuga: sin NINGÚN módulo, ningún grupo aparece (el gate por hijos no abre de más).
        expect(navParaRol("ADMIN", { modulosPermitidos: [] })).toEqual([]);
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
        const modulos = MODS_COMITE_COLEGIO;
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
            ...navParaRol("ADMIN", { modulosPermitidos: MODS_ADMIN }),
            ...navParaRol("SCHOOL_ADMIN", { modulosPermitidos: MODS_COLEGIO }),
            ...navParaRol("PARENT"),
            ...navParaRol(null),
        ];
        for (const e of muestras) {
            expect(e).not.toHaveProperty("modulo");
            expect(typeof e.href).toBe("string");
            expect(typeof e.label).toBe("string");
            // iconKey SIEMPRE presente y no vacía (por defecto = href; los grupos «#» llevan
            // una semántica sembrada — el default href se prueba en el bloque del anónimo).
            expect(typeof e.iconKey).toBe("string");
            expect(e.iconKey.length).toBeGreaterThan(0);
        }
    });
});

describe("navMovilParaRol · barra móvil {principales≤4, resto}, DATA de la fuente", () => {
    const ROLES_CON_CONFIG = Object.keys(PRINCIPALES_MOVIL);

    it("cada rol con config: los principales == Jelkin (b389037), en orden, ≤4", () => {
        for (const rol of ROLES_CON_CONFIG) {
            const { principales } = navMovilParaRol(rol, ctxDe(rol));
            expect(principales.map((e) => e.href), `principales de ${rol}`).toEqual(PRINCIPALES_MOVIL[rol]);
            expect(principales.length).toBeLessThanOrEqual(4);
        }
    });

    it("partición: principales ∪ aplanar(resto) == nav gateada aplanada, sin duplicados", () => {
        for (const rol of ROLES_CON_CONFIG) {
            const ctx = ctxDe(rol);
            const full = aplanar(navParaRol(rol, ctx)).map((e) => e.href);
            const { principales, resto } = navMovilParaRol(rol, ctx);
            // resto conserva grupos → se aplana para comparar el CONJUNTO de hojas.
            const union = [...principales, ...aplanar(resto)].map((e) => e.href);
            expect([...union].sort()).toEqual([...full].sort()); // mismo conjunto
            expect(union.length).toBe(full.length); // disjuntos (sin duplicados)
        }
    });

    it("resto CONSERVA los grupos (no aplana): el «Más» los pinta como sección", () => {
        // Colegio «Usuarios»: sin hijos promovidos → va ENTERO al resto (grupo con children).
        const { resto } = navMovilParaRol("SCHOOL_ADMIN", ctxDe("SCHOOL_ADMIN"));
        expect(resto.find((e) => e.label === "Usuarios")?.children?.map((c) => c.href)).toEqual([
            "/dashboard/colegio/profesores",
            "/dashboard/colegio/comite/integrantes",
        ]);
        // Padre: /reportar y /profesionales se promovieron → los grupos quedan en el resto con
        // el hijo que NO se promovió (Mis expedientes / Mis citas).
        const { resto: restoPadre } = navMovilParaRol("PARENT");
        expect(restoPadre.find((e) => e.label === "Reportar")?.children?.map((c) => c.href)).toEqual([
            "/dashboard/padre/expedientes",
        ]);
        expect(restoPadre.find((e) => e.label === "Ayuda profesional")?.children?.map((c) => c.href)).toEqual([
            "/dashboard/padre/citas",
        ]);
    });

    it("padre PROMUEVE hojas de grupos: Reportar→/reportar y Psicólogos→/profesionales, sin «#»", () => {
        const hrefs = navMovilParaRol("PARENT").principales.map((e) => e.href);
        expect(hrefs).toContain("/dashboard/padre/reportar");
        expect(hrefs).toContain("/dashboard/padre/profesionales");
        expect(hrefs).not.toContain("#");
    });

    it("§5-bis: el principal PROMOVIDO hereda la iconKey de su GRUPO (no cae al fallback por usar su href)", () => {
        const principales = navMovilParaRol("PARENT").principales;
        const reportar = principales.find((e) => e.href === "/dashboard/padre/reportar");
        const psicologos = principales.find((e) => e.href === "/dashboard/padre/profesionales");
        // Heredan la iconKey del grupo («Reportar» / «Ayuda profesional»), no su href.
        expect(reportar?.iconKey).toBe("reportar-grupo");
        expect(psicologos?.iconKey).toBe("ayuda-profesional");
        expect(reportar?.iconKey).not.toBe(reportar?.href); // usar el href caería al fallback «casa»
        expect(psicologos?.iconKey).not.toBe(psicologos?.href);
        // Una hoja top-level (no promovida) conserva su propia iconKey (= href por defecto).
        const inicio = principales.find((e) => e.href === "/dashboard/padre");
        expect(inicio?.iconKey).toBe("/dashboard/padre");
    });

    it("los principales van GATEADOS: un módulo no concedido cae del principal (no rebota)", () => {
        const sinComite = MODS_ADMIN.filter((m) => m !== "comite_bandeja");
        const { principales } = navMovilParaRol("ADMIN", { modulosPermitidos: sinComite });
        expect(principales.map((e) => e.href)).toEqual([
            "/dashboard/admin/inicio",
            "/dashboard/admin/bandeja",
            "/dashboard/admin/estadisticas/operacion", // SPEC-857: el principal «Estadísticas» → /operacion
        ]); // «Comité» cayó por falta de módulo; los otros 3 siguen, en orden
    });

    it("sin config (OPERADOR/COMITE_VALIDACION): SPEC-857 primera hoja de cada ícono distinto (≤4, íconos únicos)", () => {
        const ctx = { modulosPermitidos: ["bandeja_reportes", "revision_spam"] };
        const { principales, resto } = navMovilParaRol("OPERADOR", ctx);
        // «Bandeja» y «Revisión de spam» cuelgan del MISMO módulo «Reportes» → MISMO ícono; el default
        // toma solo la primera (una pestaña por sección, candado nav-iconos (1): sin íconos duplicados).
        expect(principales.map((e) => e.href)).toEqual(["/dashboard/admin/bandeja"]);
        // La hoja no promovida (spam) sigue alcanzable en el grupo «Reportes» del «Más».
        const reportes = resto.find((e) => e.label === "Reportes");
        expect(reportes?.children?.map((c) => c.href)).toContain("/dashboard/admin/spam");
    });

    it("labelCorto (mock, Diseño) propaga a los principales; el no sembrado no lo lleva (fallback a label)", () => {
        const padre = navMovilParaRol("PARENT").principales;
        expect(padre.find((e) => e.href === "/dashboard/padre/hijos")?.labelCorto).toBe("Protejo");
        expect(padre.find((e) => e.href === "/dashboard/padre/profesionales")?.labelCorto).toBe("Psicólogos");
        // «Inicio» del padre no tiene labelCorto → la barra usa el label completo (labelCorto ?? label).
        expect(padre.find((e) => e.href === "/dashboard/padre")?.labelCorto).toBeUndefined();
        // Admin: «Bandeja de reportes»→«Bandeja» (hoja del módulo «Reportes», conserva su labelCorto).
        const admin = navMovilParaRol("ADMIN", ctxDe("ADMIN")).principales;
        expect(admin.find((e) => e.href === "/dashboard/admin/bandeja")?.labelCorto).toBe("Bandeja");
        // SPEC-857: el principal «Estadísticas» pasó a /operacion (hoja sin labelCorto) → usa su label.
        expect(admin.find((e) => e.href === "/dashboard/admin/estadisticas/operacion")?.labelCorto).toBeUndefined();
    });
});

describe("PRINCIPALES_MOVIL · higiene del dato (no lista a mano que se desincroniza)", () => {
    it("cada rol: ≤4 hrefs, y cada uno EXISTE en la nav completa del rol (no stale/typo)", () => {
        for (const [rol, hrefs] of Object.entries(PRINCIPALES_MOVIL)) {
            expect(hrefs.length, `${rol} debe tener ≤4 principales`).toBeLessThanOrEqual(4);
            const full = new Set(aplanar(navParaRol(rol, ctxDe(rol))).map((e) => e.href));
            for (const href of hrefs) {
                expect(full.has(href), `${rol}: «${href}» no está en su nav (stale/typo)`).toBe(true);
            }
        }
    });
});

describe("iconKey semántica en los grupos «#» (SPEC-744, ícono distinto del lateral)", () => {
    it("cada grupo lleva su iconKey (no colisionan en «#»)", () => {
        const padre = navParaRol("PARENT");
        expect(padre.find((e) => e.label === "Reportar")?.iconKey).toBe("reportar-grupo");
        expect(padre.find((e) => e.label === "Ayuda profesional")?.iconKey).toBe("ayuda-profesional");
        const colegio = navParaRol("SCHOOL_ADMIN", { modulosPermitidos: MODS_COLEGIO });
        expect(colegio.find((e) => e.label === "Usuarios")?.iconKey).toBe("usuarios");
    });
});
