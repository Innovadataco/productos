/**
 * SPEC-744 · CANDADO — íconos de la navegación (regla POR SUPERFICIE de Diseño, cert 5cb032f §5-ter).
 *
 * El fallback «casa» (`IconoNav` sin entrada en `ICONOS_NAV`) no estaba solo en las pestañas
 * promovidas de la barra: se repetía en el lateral y en «Más» (misma raíz: cobertura de
 * `ICONOS_NAV`). Un candado acotado a la barra se quedaba corto. Diseño fijó la regla por
 * superficie y midió que ESTAS DOS cláusulas entran verdes con las 6 entradas de FASE 1:
 *
 *  (1) BARRA (navMovilParaRol.principales) — DURO:
 *      · cada `principal` resuelve a un ícono REAL (∈ ICONOS_NAV, ≠ fallback);
 *      · no hay dos principales con el mismo ícono en la barra;
 *      · el promovido lleva el ícono de SU GRUPO (herencia de `aplanar`, #708 de Dev-2) —
 *        se verifica contra el árbol lateral, no por una lista a mano.
 *      («Más» va con MasIcon fijo, excluido de la barra.)
 *
 *  (2) LATERAL y «Más» (grupos) — ESTRUCTURAL:
 *      · hijos ALL-OR-NONE por grupo (mixto → ROJO);
 *      · un hijo NO repite el ícono de su encabezado;
 *      · el encabezado de grupo resuelve ≠ fallback.
 *      (En «Más» el encabezado se pinta como TEXTO —sin ícono—; el ícono del grupo solo aplica
 *      al lateral. Por eso (2) mide la RESOLUCIÓN de iconKey del árbol, común a ambas superficies.)
 *
 * Control positivo (lo que la regla PROHÍBE): registrar en ICONOS_NAV una hoja promovida del padre
 * (p. ej. `/dashboard/padre/reportar`) rompe (2) por dos lados — su grupo «Reportar» queda desparejo
 * (all-or-none) y el hijo repite el ícono del encabezado → CI ROJA. Sin (2), «arreglar» la barra
 * registrando el href rompía el lateral EN SILENCIO (el defecto que Diseño evitó separando la
 * herencia del registro).
 *
 * FUERA DE ALCANCE HOY (FASE 2, a propósito): «hoja TOP-LEVEL ≠ fallback en lateral/«Más»». Cuatro
 * hojas de admin (verificadores · profesionales/gestion · analisis/reglas · verificacion) esperan
 * SVG PROPIOS de Diseño; exigirlo hoy pondría la CI roja sobre íconos que aún no existen.
 *
 * Usa los resolvers REALES (no mock): prueba la resolución de íconos de verdad.
 */
import { describe, it, expect } from "vitest";
import { navParaRol, navMovilParaRol, type NavEntry } from "@/lib/nav/para-rol";
import { ICONOS_NAV, tieneIcono } from "@/components/modules/nav/IconoNav";
import { ADMIN_NAV_ITEMS, COLEGIO_NAV_ITEMS, COMITE_COLEGIO_NAV_ITEMS, PRINCIPALES_MOVIL, type NavItem } from "@/lib/nav-items";

function modulosDe(items: NavItem[]): string[] {
    const out: string[] = [];
    for (const i of items) {
        if (i.modulo) out.push(i.modulo);
        if (i.children) out.push(...modulosDe(i.children));
    }
    return out;
}
// Con ctx=TODOS cada barra CURADA gate-in completa y cada grupo del lateral rinde el máximo de
// hijos (la consistencia con TODOS los miembros implica la de cualquier subconjunto → es la
// comprobación más estricta).
const TODOS = [...new Set([...modulosDe(ADMIN_NAV_ITEMS), ...modulosDe(COLEGIO_NAV_ITEMS), ...modulosDe(COMITE_COLEGIO_NAV_ITEMS)])];
const ctx = { modulosPermitidos: TODOS, profesional: { habilitado: true } };

// Roles con barra CURADA (PRINCIPALES_MOVIL, data de Jelkin): la superficie que este candado
// blinda, y cubren TODOS los grupos del árbol (padre: Reportar/Ayuda · colegio: Usuarios). Data-
// driven, no lista a mano. OPERADOR/COMITE_VALIDACION usan «primeras ≤4» sobre la nav de admin
// (plana, sin grupos) → fuera del contrato de barra curada.
const ROLES = Object.keys(PRINCIPALES_MOVIL);

/**
 * Ícono que la BARRA MÓVIL debe pintar para cada href, derivado del árbol lateral: una hoja
 * top-level muestra su propia `iconKey`; una hoja promovida de un grupo HEREDA la `iconKey` del
 * grupo (lo que hace `aplanar`). Es el contrato de (1c) leído desde la fuente, sin lista a mano.
 */
function iconKeyEsperadaEnBarra(tree: NavEntry[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const item of tree) {
        if (item.children && item.children.length > 0) {
            for (const h of item.children) m.set(h.href, item.iconKey); // hereda del grupo
        } else {
            m.set(item.href, item.iconKey);
        }
    }
    return m;
}

const gruposDe = (tree: NavEntry[]): NavEntry[] => tree.filter((i) => i.children && i.children.length > 0);

describe("SPEC-744 (1) · BARRA: cada principal ≠ fallback, único, y el promovido lleva el ícono de su grupo", () => {
    for (const rol of ROLES) {
        const { principales } = navMovilParaRol(rol, ctx);
        const esperada = iconKeyEsperadaEnBarra(navParaRol(rol, ctx));

        it(`${rol}: cada principal resuelve a ícono real y lleva la iconKey que le toca (herencia de grupo)`, () => {
            expect(principales.length, `${rol} sin principales`).toBeGreaterThan(0);
            for (const p of principales) {
                const clave = esperada.get(p.href);
                expect(clave, `${rol} · «${p.label}» (${p.href}) no aparece en el árbol lateral`).toBeDefined();
                expect(p.iconKey, `${rol} · «${p.label}»: la barra usa ${p.iconKey} pero el árbol manda ${clave} (¿herencia rota?)`).toBe(clave);
                expect(ICONOS_NAV[p.iconKey], `${rol} · «${p.label}» (iconKey=${p.iconKey}) sin entrada en ICONOS_NAV → fallback «casa»`).toBeDefined();
            }
        });

        it(`${rol}: no hay dos principales con el mismo ícono`, () => {
            const comps = principales.map((p) => ICONOS_NAV[p.iconKey]);
            expect(new Set(comps).size, `${rol}: íconos duplicados entre principales`).toBe(principales.length);
        });
    }
});

describe("SPEC-744 (2) · LATERAL y «Más»: grupos consistentes (all-or-none · hijo ≠ encabezado · encabezado ≠ fallback)", () => {
    for (const rol of ROLES) {
        // El MISMO catálogo de grupos alimenta el lateral (navParaRol) y «Más» (navMovilParaRol.resto,
        // con los hijos promovidos ya quitados). Se verifican ambas superficies.
        const superficies: Array<{ nombre: string; grupos: NavEntry[] }> = [
            { nombre: "lateral", grupos: gruposDe(navParaRol(rol, ctx)) },
            { nombre: "«Más»", grupos: gruposDe(navMovilParaRol(rol, ctx).resto) },
        ];
        for (const { nombre, grupos } of superficies) {
            for (const g of grupos) {
                const hijos = g.children ?? [];
                it(`${rol} · ${nombre} · grupo «${g.label}»: encabezado ≠ fallback, hijos parejos y sin repetir el ícono del encabezado`, () => {
                    // (2c) el encabezado del grupo resuelve a un ícono real.
                    expect(tieneIcono(g.iconKey), `encabezado «${g.label}» (${g.iconKey}) sin ícono → fallback`).toBe(true);
                    // (2a) all-or-none: los hijos o todos con ícono o ninguno.
                    const conIcono = hijos.map((h) => tieneIcono(h.iconKey));
                    const parejo = conIcono.every((x) => x === conIcono[0]);
                    expect(parejo, `grupo «${g.label}» desparejo: ${hijos.map((h) => `${h.label}=${tieneIcono(h.iconKey)}`).join(", ")}`).toBe(true);
                    // (2b) ningún hijo repite el ícono del encabezado.
                    const iconoEncabezado = ICONOS_NAV[g.iconKey];
                    for (const h of hijos) {
                        if (tieneIcono(h.iconKey)) {
                            expect(ICONOS_NAV[h.iconKey], `hijo «${h.label}» repite el ícono del encabezado «${g.label}»`).not.toBe(iconoEncabezado);
                        }
                    }
                });
            }
        }
    }
});
