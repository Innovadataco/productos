/**
 * SPEC-744 · `navParaRol` — la FUENTE ÚNICA de la navegación por rol.
 *
 * Antes de esta spec cada superficie armaba su propia lista + compuerta —el defecto
 * que cazó Jelkin: el NavHeader tenía la nav ESCRITA A MANO por rol (el padre: «Mi
 * panel/Círculo de Confianza/Mis reportes», stale, distinta de `PADRE_NAV_ITEMS`).
 * Dos fuentes → desincronización → recurre. Este módulo colapsa TODO a una función:
 * las superficies vivas —NavLateral (escritorio), BarraInferior/HojaMas (móvil) y el
 * NavHeader anónimo— llaman `navParaRol(rol, ctx)` y pintan lo que devuelve. Cero
 * listas a mano (el candado `nav-superficie-unica.candado.test.tsx` rompe CI si
 * alguna superficie vuelve a quemar destinos de nav).
 *
 * ── CAVEAT (orden del CEO) ────────────────────────────────────────────────────
 * Esto es VISIBILIDAD, no ACCESO. La compuerta módulo/estado/proxy de acá decide
 * qué se MUESTRA en el menú; NO protege la página. Los guardias de página/route
 * server-side quedan intactos e independientes. Un candado de nav en verde NUNCA
 * significa «la página está cerrada» (esconder el menú no cierra la pantalla; un
 * gate por valor del cliente falla abierto).
 */
import {
    ADMIN_NAV_ITEMS,
    COLEGIO_NAV_ITEMS,
    COMITE_COLEGIO_NAV_ITEMS,
    PADRE_NAV_ITEMS,
    ANONIMO_NAV_ITEMS,
    PRINCIPALES_MOVIL,
    type NavItem,
    type PadreNavItem,
} from "@/lib/nav-items";
import { entradasProfesional, type EstadoProfesionalSesion } from "@/lib/profesional/menu-por-estado";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

/**
 * Lo que una superficie necesita para pintar: destino + rótulo + hijos. Sin `modulo`
 * —la compuerta ya se aplicó— ni presentación (íconos/estado activo son de cada
 * superficie). Es el tipo COMÚN que unifica `NavItem` (con módulo) y `PadreNavItem`.
 */
export interface NavEntry {
    href: string;
    label: string;
    /** Clave del ícono (registro cliente key→componente, SPEC-744). Por defecto `href`. */
    iconKey: string;
    /** Rótulo corto para la barra móvil (1 palabra); si falta, la superficie usa `label`. */
    labelCorto?: string;
    children?: NavEntry[];
}

/** El contexto de la sesión que la compuerta necesita; cada rol usa lo suyo. */
export interface CtxNav {
    /** Módulos concedidos (ADMIN/OPERADOR/COMITE_VALIDACION/colegio). */
    modulosPermitidos?: string[];
    /** Estado de verificación del profesional (`habilitado` de /api/me). */
    profesional?: EstadoProfesionalSesion;
    /** Ruta actual — SOLO para el override del muro de aceptación del profesional. */
    pathname?: string | null;
}

// SPEC-703/686: mientras el profesional no acepte la versión vigente, la guardia
// rebota cada ítem operativo a este muro. Ofrecer el menú operativo es ofrecer
// entradas que rebotan → se colapsa a PORTERO (cosmético; el cierre real lo hace
// el servidor). Criterio de SPEC-691, hoy centralizado en este resolver (antes
// repetido por la barra lateral del profesional).
const RUTA_ACEPTACION_AUTORIZACION = "/perfil-profesional/autorizacion";

/** Quita `modulo`, resuelve `iconKey` (por defecto `href`) y normaliza hijos (recursivo). */
function desnudar(item: NavItem | PadreNavItem): NavEntry {
    const base: NavEntry = { href: item.href, label: item.label, iconKey: item.iconKey ?? item.href };
    if (item.labelCorto) base.labelCorto = item.labelCorto;
    if (item.children && item.children.length > 0) {
        base.children = item.children.map(desnudar);
    }
    return base;
}

/**
 * Filtra una lista por módulo concedido ∧ predicado del proxy (D-41), respetando
 * los grupos: un nodo con hijos se muestra solo si su módulo está concedido Y le
 * queda al menos un hijo visible; los hijos se filtran con el mismo criterio.
 * Esta compuerta ANTES estaba repetida en cada barra lateral (ya retiradas por
 * SPEC-744); ahora vive UNA sola vez acá y la consumen NavLateral / BarraInferior.
 */
function porModuloYProxy(items: NavItem[], rol: string, permitidos: Set<string>): NavEntry[] {
    const salida: NavEntry[] = [];
    for (const item of items) {
        if (item.children && item.children.length > 0) {
            const hijos = item.children.filter(
                (h) => permitidos.has(h.modulo) && esDestinoPermitidoPorRol(rol, h.href),
            );
            if (!permitidos.has(item.modulo) || hijos.length === 0) continue;
            // `desnudar` da href/label/iconKey/labelCorto del padre; se le sustituyen los
            // hijos por los YA filtrados (no todos los del catálogo).
            salida.push({ ...desnudar(item), children: hijos.map(desnudar) });
        } else if (permitidos.has(item.modulo) && esDestinoPermitidoPorRol(rol, item.href)) {
            salida.push(desnudar(item));
        }
    }
    return salida;
}

/**
 * La navegación que corresponde MOSTRAR al rol dado en su sesión.
 *
 *  - anónimo (rol nulo): la superficie pública (Estadísticas públicas). «Iniciar
 *    sesión» es control de CUENTA, no nav — vive aparte (simétrico con «Cerrar
 *    sesión» del logueado, SPEC-742).
 *  - PARENT: `PADRE_NAV_ITEMS` completo — el área del padre no filtra por módulo;
 *    el proxy controla el acceso y el menú muestra todo (lo pintan NavLateral y BarraInferior).
 *  - PROFESIONAL: `entradasProfesional` (por estado `habilitado`, con override del
 *    muro de aceptación) ∧ proxy.
 *  - SCHOOL_ADMIN / COMITE_CONVIVENCIA: su lista de colegio, módulo ∧ proxy.
 *  - resto (ADMIN/OPERADOR/COMITE_VALIDACION y demás internos): ADMIN_NAV_ITEMS,
 *    módulo ∧ proxy.
 */
export function navParaRol(rol: string | null | undefined, ctx: CtxNav = {}): NavEntry[] {
    if (!rol) return ANONIMO_NAV_ITEMS.map(desnudar);

    const permitidos = new Set(ctx.modulosPermitidos ?? []);

    switch (rol) {
        case "PARENT":
            return PADRE_NAV_ITEMS.map(desnudar);
        case "PROFESIONAL": {
            const enMuro = ctx.pathname === RUTA_ACEPTACION_AUTORIZACION;
            return entradasProfesional(enMuro ? null : ctx.profesional)
                .filter((l) => esDestinoPermitidoPorRol(rol, l.href))
                .map(desnudar);
        }
        case "SCHOOL_ADMIN":
            return porModuloYProxy(COLEGIO_NAV_ITEMS, rol, permitidos);
        case "COMITE_CONVIVENCIA":
            return porModuloYProxy(COMITE_COLEGIO_NAV_ITEMS, rol, permitidos);
        default:
            return porModuloYProxy(ADMIN_NAV_ITEMS, rol, permitidos);
    }
}

/**
 * Aplana los grupos para una barra sin acordeones (la barra móvil): un nodo con
 * hijos aporta sus hijos, no su etiqueta «#». Los nodos hoja pasan tal cual.
 * Lo usa BarraInferior (el aplanado que antes hacía a mano la barra móvil del padre).
 */
export function aplanar(items: NavEntry[]): NavEntry[] {
    return items.flatMap((item) => (item.children && item.children.length > 0 ? item.children : [item]));
}

/**
 * La partición de la barra móvil: los ≤4 destinos principales + el resto (para el «Más»).
 * `principales` son HOJAS (planas, con promoción de hojas de grupos). `resto` CONSERVA la
 * estructura de grupos —un grupo va entero (menos los hijos ya promovidos), las hojas sueltas
 * como ítem— para que el «Más» pinte cada grupo como sección (encabezado + hijos).
 */
export interface NavMovil {
    principales: NavEntry[];
    resto: NavEntry[];
}

/**
 * SPEC-744 · la barra inferior móvil: `navMovilParaRol(rol, ctx)` → {principales≤4, resto}.
 *
 * Parte de la nav del rol YA gateada (`aplanar(navParaRol(rol, ctx))` — módulo/estado/proxy
 * aplicados, grupos aplanados a sus hojas). Los PRINCIPALES salen de `PRINCIPALES_MOVIL[rol]`
 * (data curada por Jelkin, b389037), en su orden, intersectada con lo gateado (un principal
 * cuyo módulo no está concedido simplemente no aparece → puede quedar <4). Sin config para el
 * rol (OPERADOR/COMITE_VALIDACION) el default es «los primeros ≤4 de la nav gateada». El resto
 * conserva el orden de la lista.
 *
 * Es la MISMA fuente que el lateral (cero lista a mano en la barra); el candado de dato vive
 * en `para-rol.test.ts` y el de render (la barra pinta EXACTO estos principales) es del
 * componente BarraInferior (reparto con Dev-1). VISIBILIDAD, no acceso.
 */
export function navMovilParaRol(rol: string | null | undefined, ctx: CtxNav = {}): NavMovil {
    const tree = navParaRol(rol, ctx); // árbol gateado (grupos conservados)
    const plano = aplanar(tree); // hojas gateadas (para elegir los principales)
    const orden = rol ? PRINCIPALES_MOVIL[rol] : undefined;

    let principales: NavEntry[];
    if (!orden) {
        // Sin curaduría: las primeras ≤4 hojas en orden de la lista (FORMA §3, familia admin).
        principales = plano.slice(0, 4);
    } else {
        const porHref = new Map(plano.map((e) => [e.href, e]));
        principales = [];
        for (const href of orden) {
            const entrada = porHref.get(href);
            if (entrada) principales.push(entrada); // omitido si el rol no lo tiene gateado
            if (principales.length === 4) break;
        }
    }
    const enPrincipales = new Set(principales.map((e) => e.href));

    // `resto` CONSERVA los grupos (Dev-1 los pinta como sección en el «Más»): un grupo va
    // entero menos los hijos ya promovidos a principal; si le quedan hijos, se incluye con
    // ellos; si no, se omite. Las hojas sueltas van como ítem. NO se aplana.
    const resto: NavEntry[] = [];
    for (const item of tree) {
        if (item.children && item.children.length > 0) {
            const hijos = item.children.filter((h) => !enPrincipales.has(h.href));
            if (hijos.length > 0) resto.push({ ...item, children: hijos });
        } else if (!enPrincipales.has(item.href)) {
            resto.push(item);
        }
    }
    return { principales, resto };
}
