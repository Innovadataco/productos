import { describe, it, expect } from "vitest";
import { ADMIN_NAV_ITEMS, COLEGIO_NAV_ITEMS, COMITE_NAV_TABS, IA_TABS } from "./nav-items";
import { CATALOGO_MODULOS } from "./permisos-catalogo";

/**
 * Test estructural anti-regresión (spec 086, D-4):
 * falla si un ítem de menú referencia una clave que no existe en el catálogo,
 * o si un módulo "visible" del catálogo queda sin ítem de menú (y no está en
 * la lista blanca de módulos sin pantalla propia, research.md §3.3).
 */

const CLAVES_CATALOGO = new Set(CATALOGO_MODULOS.map((m) => m.clave));

// Módulos sin ítem de menú propio (contenedores, tabs IA, audit_logs) — research.md §3.3
const SIN_PANTALLA_PROPIA = new Set([
    "comite",
    "ia_playground",
    "ia_rubrica",
    "ia_eval",
    "ia_simulaciones",
    "ia_configuracion",
    "configuracion_permisos",
    "audit_logs",
]);

const TODOS_LOS_ITEMS = [...ADMIN_NAV_ITEMS, ...COLEGIO_NAV_ITEMS, ...COMITE_NAV_TABS];

describe("estructura menú ↔ catálogo", () => {
    it("todo ítem de menú referencia un módulo existente en el catálogo", () => {
        for (const item of TODOS_LOS_ITEMS) {
            expect(CLAVES_CATALOGO.has(item.modulo), `ítem "${item.label}" → clave desconocida "${item.modulo}"`).toBe(true);
        }
    });

    it("todo módulo visible tiene ítem de menú (o está justificado como sin pantalla propia)", () => {
        const clavesEnMenu = new Set(TODOS_LOS_ITEMS.map((i) => i.modulo));
        for (const modulo of CATALOGO_MODULOS) {
            const cubierto = clavesEnMenu.has(modulo.clave) || SIN_PANTALLA_PROPIA.has(modulo.clave);
            expect(cubierto, `módulo "${modulo.clave}" sin ítem de menú ni justificación`).toBe(true);
        }
    });

    it("las tabs IA con módulo referencian claves existentes", () => {
        for (const tab of IA_TABS) {
            if (tab.modulo !== null) {
                expect(CLAVES_CATALOGO.has(tab.modulo), `tab IA "${tab.label}" → clave desconocida`).toBe(true);
            }
        }
    });

    it("los submódulos del menú tienen padre consistente con el catálogo", () => {
        const porClave = new Map(CATALOGO_MODULOS.map((m) => [m.clave, m]));
        for (const item of TODOS_LOS_ITEMS) {
            const modulo = porClave.get(item.modulo);
            if (modulo?.padre) {
                expect(CLAVES_CATALOGO.has(modulo.padre), `padre "${modulo.padre}" de "${item.modulo}" no existe`).toBe(true);
            }
        }
    });
});
