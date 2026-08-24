import { describe, it, expect } from "vitest";
import { ADMIN_NAV_ITEMS, COLEGIO_NAV_ITEMS, COMITE_COLEGIO_NAV_ITEMS, COMITE_NAV_TABS, IA_TABS, PADRE_NAV_ITEMS } from "./nav-items";
import type { NavItem } from "./nav-items";
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
    "ia_simulaciones",
    "ia_configuracion",
    "configuracion_permisos",
    "audit_logs",
    // Permiso de acción (spec 096): revelar texto original dentro del expediente, sin pantalla propia
    "expediente_revelar_original",
    // SPEC-140 (F2): generar la denuncia formal es una acción dentro del expediente
    // (botón + descarga), sin pantalla propia.
    "denuncia_formal",
    // SPEC-141 (N-1): las pantallas de solo lectura se abren en contexto desde las
    // vistas de padres/colegios (enlace directo), sin ítem de menú propio.
    "soporte_lectura",
    // SPEC-169 (Fase G): las notificaciones in-app se consumen desde el centro de
    // notificaciones en el header; no tienen ítem de menú lateral propio.
    "colegios_notificaciones",
    // SPEC-173 (FASE-C): el onboarding salió del menú lateral; sigue accesible por
    // su flujo (URL directa / reactivación), sin ítem de menú propio.
    "colegios_onboarding",
    // SPEC-180: la página Monitoreo worker salió del menú (redundante con el
    // tablero operativo de SPEC-171); la ruta redirige a operación.
    "monitoreo_worker",
    // SPEC-194 (002-PI-088): analítica de colegios es un sub-tab dentro de
    // `/dashboard/admin/estadisticas/operacion`; no tiene ítem de menú lateral propio.
    "analytics_colegios",
    // SPEC-206 (002-PI-120): sesiones activas es un sub-tab dentro de
    // `/dashboard/admin/estadisticas/operacion`; no tiene ítem de menú lateral propio.
    "sesiones_admin",
    // SPEC-235 (002-PI-135): guías de acción parametrizables es un sub-tab dentro de
    // `/dashboard/admin/configuracion`; no tiene ítem de menú lateral propio.
    "guias_accion_admin",
    // SPEC-202/203: el panel de notificaciones es un tab dentro de
    // `/dashboard/admin/configuracion`; no tiene ítem de menú lateral propio.
    "configuracion_notificaciones",
    // SPEC-202: salud del motor de notificaciones es una sub-página del área
    // Estadísticas (sub-nav); no tiene ítem de menú lateral propio.
    "estadisticas_salud_motor",
]);

// SPEC-173 (FASE-C): los nodos expandibles (p. ej. "Usuarios") declaran hijos;
// el test valida tanto padres como children contra el catálogo.
function aplanar(items: NavItem[]): NavItem[] {
    return items.flatMap((item) => [item, ...aplanar(item.children ?? [])]);
}

const TODOS_LOS_ITEMS = aplanar([...ADMIN_NAV_ITEMS, ...COLEGIO_NAV_ITEMS, ...COMITE_COLEGIO_NAV_ITEMS, ...COMITE_NAV_TABS, ...PADRE_NAV_ITEMS]);

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
