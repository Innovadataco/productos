/**
 * SPEC-744 · CANDADO — íconos de la navegación (regla POR SUPERFICIE de Diseño, cert 5cb032f §5-ter
 * + FASE 2 d6fc77d). El fallback «casa» (`IconoNav` sin entrada en `ICONOS_NAV`) no estaba solo en
 * las pestañas promovidas de la barra: se repetía en el lateral y en «Más» (misma raíz: cobertura de
 * `ICONOS_NAV`). Tres cláusulas, sobre TODOS los roles que el resolver atiende:
 *
 *  (1) BARRA (navMovilParaRol.principales) — DURO, para CADA rol con barra:
 *      · cada `principal` resuelve a un ícono REAL (∈ ICONOS_NAV) — o, si aún no, es deuda
 *        REGISTRADA de FASE 2 (nunca un hueco silencioso);
 *      · no hay dos principales que rindan el MISMO ícono en la barra (fallback incluido: dos
 *        «casas» también es duplicado);
 *      · el promovido lleva el ícono de SU GRUPO (herencia de `aplanar`, #708) — verificado contra
 *        el árbol lateral, no por una lista a mano.
 *      Los roles internos sin barra curada (OPERADOR/COMITE_VALIDACION) usan «primeras ≤4» sobre la
 *      nav de admin y PINTAN barra igual (Jelkin metió al OPERADOR al flujo de citas): entran a (1)
 *      con la misma garantía mínima. La lista de roles sale del enum, no de PRINCIPALES_MOVIL.
 *
 *  (2) LATERAL y «Más» (grupos) — ESTRUCTURAL:
 *      · hijos ALL-OR-NONE por grupo (mixto → ROJO);
 *      · un hijo NO repite el ícono de su encabezado;
 *      · el encabezado de grupo resuelve ≠ fallback.
 *
 *  (3) DEUDA FASE 2 — TRINQUETE con igualdad EXACTA (reemplaza la prosa «fuera de alcance»):
 *      el conjunto de hojas TOP-LEVEL que caen al fallback (∉ ICONOS_NAV) es IGUAL a
 *      `PENDIENTES_FASE_2` — ni más ni menos. Así: (a) una 5ª hoja nueva sin ícono pone CI roja
 *      (deuda sin registrar → el defecto no vuelve en silencio); (b) registrar el ícono de una
 *      pendiente sin sacarla de la lista TAMBIÉN pone roja (sobra). La lista solo puede ENCOGER;
 *      FASE 2 cierra cuando queda vacía y (3) pasa a ser «ninguna hoja top-level cae al fallback».
 *
 * Control positivo (lo que la regla PROHÍBE):
 *  · registrar en ICONOS_NAV una hoja promovida del padre (p.ej. `/dashboard/padre/reportar`) rompe
 *    (2) —grupo desparejo + hijo repite encabezado—; era la costura que rompía el lateral en silencio.
 *  · quitar un href de `PENDIENTES_FASE_2` (o registrar su ícono sin sacarlo) rompe (3).
 *
 * Usa los resolvers REALES (no mock): prueba la resolución de íconos de verdad.
 */
import { describe, it, expect } from "vitest";
import { navParaRol, navMovilParaRol, type NavEntry } from "@/lib/nav/para-rol";
import { ICONOS_NAV, tieneIcono, InicioIcon } from "@/components/modules/nav/IconoNav";
import { ADMIN_NAV_ITEMS, COLEGIO_NAV_ITEMS, COMITE_COLEGIO_NAV_ITEMS, type NavItem } from "@/lib/nav-items";
import { RolUsuario } from "@prisma/client";

function modulosDe(items: NavItem[]): string[] {
    const out: string[] = [];
    for (const i of items) {
        if (i.modulo) out.push(i.modulo);
        if (i.children) out.push(...modulosDe(i.children));
    }
    return out;
}
// Con ctx=TODOS cada barra CURADA gate-in completa, los internos rinden su «primeras ≤4», y cada
// grupo del lateral rinde el máximo de hijos (consistencia con todos los miembros ⇒ con cualquier
// subconjunto → la comprobación más estricta).
const TODOS = [...new Set([...modulosDe(ADMIN_NAV_ITEMS), ...modulosDe(COLEGIO_NAV_ITEMS), ...modulosDe(COMITE_COLEGIO_NAV_ITEMS)])];
const ctx = { modulosPermitidos: TODOS, profesional: { habilitado: true } };

// TODOS los roles que el resolver ATIENDE (cada uno pinta BarraInferior + NavLateral). Data-driven
// desde el enum de Prisma → un rol nuevo queda cubierto sin tocar esta lista (por eso NO sale de
// PRINCIPALES_MOVIL, que deja OPERADOR/COMITE_VALIDACION afuera).
const ROLES = Object.values(RolUsuario) as string[];

// Deuda REGISTRADA de FASE 2 (cert Diseño d6fc77d §5-ter): hojas TOP-LEVEL de admin que HOY caen al
// fallback porque esperan SVG propios de Diseño. Ver cláusula (3): igualdad exacta, la lista solo
// puede encoger. Cuando FASE 2 registre sus 4 íconos y este set quede vacío, (3) se vuelve la regla
// dura «ninguna hoja top-level cae al fallback».
const PENDIENTES_FASE_2 = new Set<string>([
    "/dashboard/admin/verificadores",
    "/dashboard/admin/profesionales/gestion",
    "/dashboard/admin/analisis/reglas",
    "/dashboard/admin/verificacion",
]);

/** Hoja = ítem del árbol SIN hijos (los grupos van por la cláusula (2)). */
const hojasTopLevel = (tree: NavEntry[]): NavEntry[] => tree.filter((i) => !(i.children && i.children.length > 0));
const gruposDe = (tree: NavEntry[]): NavEntry[] => tree.filter((i) => i.children && i.children.length > 0);

/**
 * Ícono que la BARRA debe pintar para cada href, derivado del árbol lateral: una hoja top-level
 * muestra su propia `iconKey`; una hoja promovida de un grupo HEREDA la `iconKey` del grupo (lo que
 * hace `aplanar`). Es el contrato de (1c) leído desde la fuente, sin lista a mano.
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

describe("SPEC-744 (1) · BARRA: cada principal ≠ fallback (o deuda registrada), único, y el promovido lleva el ícono de su grupo", () => {
    for (const rol of ROLES) {
        const { principales } = navMovilParaRol(rol, ctx);
        const esperada = iconKeyEsperadaEnBarra(navParaRol(rol, ctx));

        it(`${rol}: cada principal resuelve a ícono real (o es deuda FASE 2) y lleva la iconKey que le toca`, () => {
            expect(principales.length, `${rol} sin principales`).toBeGreaterThan(0);
            for (const p of principales) {
                const clave = esperada.get(p.href);
                expect(clave, `${rol} · «${p.label}» (${p.href}) no aparece en el árbol lateral`).toBeDefined();
                expect(p.iconKey, `${rol} · «${p.label}»: la barra usa ${p.iconKey} pero el árbol manda ${clave} (¿herencia rota?)`).toBe(clave);
                if (!tieneIcono(p.iconKey)) {
                    // Puede caer al fallback SOLO si es deuda registrada de FASE 2; si no, es hueco silencioso.
                    expect(PENDIENTES_FASE_2.has(p.href), `${rol} · «${p.label}» (${p.href}) cae al fallback «casa» y NO es deuda registrada de FASE 2`).toBe(true);
                }
            }
        });

        it(`${rol}: no hay dos principales que rindan el mismo ícono (fallback «casa» incluido)`, () => {
            // Render real de la barra: `ICONOS_NAV[clave] ?? InicioIcon` (fallback de BarraInferior).
            const comps = principales.map((p) => ICONOS_NAV[p.iconKey] ?? InicioIcon);
            expect(new Set(comps).size, `${rol}: íconos duplicados en la barra (dos «casas» cuenta)`).toBe(principales.length);
        });
    }
});

describe("SPEC-744 (2) · LATERAL y «Más»: grupos consistentes (all-or-none · hijo ≠ encabezado · encabezado ≠ fallback)", () => {
    for (const rol of ROLES) {
        const superficies: Array<{ nombre: string; grupos: NavEntry[] }> = [
            { nombre: "lateral", grupos: gruposDe(navParaRol(rol, ctx)) },
            { nombre: "«Más»", grupos: gruposDe(navMovilParaRol(rol, ctx).resto) },
        ];
        for (const { nombre, grupos } of superficies) {
            for (const g of grupos) {
                const hijos = g.children ?? [];
                it(`${rol} · ${nombre} · grupo «${g.label}»: encabezado ≠ fallback, hijos parejos y sin repetir el ícono del encabezado`, () => {
                    expect(tieneIcono(g.iconKey), `encabezado «${g.label}» (${g.iconKey}) sin ícono → fallback`).toBe(true);
                    const conIcono = hijos.map((h) => tieneIcono(h.iconKey));
                    const parejo = conIcono.every((x) => x === conIcono[0]);
                    expect(parejo, `grupo «${g.label}» desparejo: ${hijos.map((h) => `${h.label}=${tieneIcono(h.iconKey)}`).join(", ")}`).toBe(true);
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

describe("SPEC-744 (3) · deuda FASE 2: las hojas top-level SIN ícono son EXACTAMENTE PENDIENTES_FASE_2 (trinquete)", () => {
    it("el conjunto de hojas top-level que caen al fallback es IGUAL a PENDIENTES_FASE_2 (ni sobra ni falta)", () => {
        const sinIcono = new Set<string>();
        for (const rol of ROLES) {
            for (const hoja of hojasTopLevel(navParaRol(rol, ctx))) {
                if (!tieneIcono(hoja.iconKey)) sinIcono.add(hoja.href);
            }
        }
        // Igualdad EXACTA, en dos direcciones (control positivo por ambos lados):
        const faltanEnLista = [...sinIcono].filter((h) => !PENDIENTES_FASE_2.has(h)).sort();
        const sobranEnLista = [...PENDIENTES_FASE_2].filter((h) => !sinIcono.has(h)).sort();
        expect(faltanEnLista, "hojas top-level SIN ícono que NO están en PENDIENTES_FASE_2 (deuda sin registrar → el fallback vuelve en silencio)").toEqual([]);
        expect(sobranEnLista, "hrefs en PENDIENTES_FASE_2 que YA tienen ícono o ya no existen: sacalos de la lista (solo puede encoger)").toEqual([]);
    });
});
