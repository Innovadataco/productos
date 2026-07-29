/**
 * SPEC-126 (D6 + condición ZEUS 2): fuentes estáticas del menú para la aserción B.
 * - Header: se parsean los hrefs literales de `NavHeader.tsx` y se resuelven los
 *   dinámicos (`dashboardHref`, `logoHref`) replicando la tabla del JSX. Si aparece
 *   un `href={...}` no resoluble estáticamente, se FALLA RUIDOSO listándolo (nunca
 *   se salta en silencio). Las guardas de rol por href viven en GUARDAS_HEADER y la
 *   cobertura es total: un href literal sin guarda declarada también falla ruidoso.
 * - Arrays de `nav-items.ts`: se importan (fuente estructurada). El menú que los
 *   pinta filtra por módulos de BD; la aproximación estática son los grants por
 *   defecto del seed (`clavesPorRol` en `prisma/seed.ts`), documentada en el informe.
 */
import * as fs from "node:fs";
import {
    ADMIN_NAV_ITEMS,
    COLEGIO_NAV_ITEMS,
    COMITE_NAV_TABS,
    IA_TABS,
    type NavItem,
} from "../../../src/lib/nav-items";
import { CATALOGO_MODULOS } from "../../../src/lib/permisos-catalogo";
import { RUTA_NAV_HEADER, RUTA_SEED } from "./paths";
import type { RolBarrido } from "./veredictos";

/* ---------- Header (NavHeader.tsx) ---------- */

/** `dashboardHref` del header (NavHeader.tsx:67-71). */
export function dashboardHrefPorRol(rol: RolBarrido): string {
    if (rol === "SCHOOL_ADMIN") return "/dashboard/colegio";
    if (rol === "PARENT") return "/dashboard";
    return "/dashboard-publico";
}

/**
 * Destinos posibles del logo por rol (NavHeader.tsx:73-88): dentro del área
 * autenticada va al panel del rol; fuera de ella (o sin sesión) va a "/".
 * Se evalúan ambos destinos porque dependen del `pathname` en runtime.
 */
export function hrefsLogoPorRol(rol: RolBarrido): string[] {
    if (rol === "ANONIMO") return ["/"];
    if (rol === "ADMIN" || rol === "OPERADOR") return ["/", "/dashboard/admin"];
    if (rol === "COMITE_VALIDACION") return ["/", "/dashboard/admin/comite"];
    if (rol === "SCHOOL_ADMIN") return ["/", "/dashboard/colegio"];
    return ["/", "/dashboard"];
}

/**
 * Guarda de rol por href literal, extraída del JSX de NavHeader.tsx (cada enlace se
 * pinta dentro de `{guarda && ...}`; `esEnlaceNavegable` aplica ADEMÁS el predicado).
 * Cobertura total validada en `parsearHeader`: un literal sin guarda = fallo ruidoso.
 */
const GUARDAS_HEADER: Record<string, (rol: RolBarrido) => boolean> = {
    "/": () => true,
    "/dashboard-publico": () => true,
    "/login": (rol) => rol === "ANONIMO",
    "/cambiar-password": (rol) => rol !== "ANONIMO",
    "/dashboard": (rol) => rol === "PARENT",
    "/dashboard/circulo-confianza": (rol) => rol === "PARENT",
    "/mis-reportes": (rol) => rol === "PARENT",
    "/dashboard/admin": (rol) => rol === "ADMIN" || rol === "OPERADOR",
    "/dashboard/admin/configuracion": (rol) => rol === "ADMIN",
    "/dashboard/admin/comite": (rol) => rol === "COMITE_VALIDACION",
    "/dashboard/colegio": (rol) => rol === "SCHOOL_ADMIN",
};

/** href={x} que sabemos resolver estáticamente; cualquier otro falla ruidoso (ZEUS 2).
 *  "href" es la prop pass-through de NavDropdownLink/MobileLink (el valor real es el
 *  literal del call-site, ya capturado como literal). */
const DINAMICOS_RESOLUBLES = new Set(["dashboardHref", "logoHref", "href"]);

export interface FuentesHeader {
    /** Hrefs literales pintados para el rol (guarda JSX ∧ ya envueltos en esEnlaceNavegable). */
    hrefsPintados: (rol: RolBarrido) => string[];
    /** Hrefs que el logo puede tener por rol (siempre pintado). */
    hrefsLogo: (rol: RolBarrido) => string[];
    literales: string[];
}

export function parsearHeader(): FuentesHeader {
    const texto = fs.readFileSync(RUTA_NAV_HEADER, "utf-8");
    const literales = new Set<string>();
    for (const m of texto.matchAll(/esEnlaceNavegable\("([^"]+)"\)/g)) literales.add(m[1]);
    for (const m of texto.matchAll(/href="([^"]+)"/g)) literales.add(m[1]);

    const dinamicos = [...new Set([...texto.matchAll(/href=\{(\w+)\}/g)].map((m) => m[1]))].sort();
    const noResolubles = dinamicos.filter((d) => !DINAMICOS_RESOLUBLES.has(d));
    if (noResolubles.length > 0) {
        throw new Error(
            `[Arch:B] href del header NO resoluble estáticamente: ${noResolubles.join(", ")} ` +
                `(src/components/modules/NavHeader.tsx). Resolverlo en scripts/arch/lib/nav-fuentes.ts.`
        );
    }
    const sinGuarda = [...literales].filter((h) => !(h in GUARDAS_HEADER));
    if (sinGuarda.length > 0) {
        throw new Error(
            `[Arch:B] href literal del header SIN guarda de rol declarada: ${sinGuarda.join(", ")} ` +
                `(src/components/modules/NavHeader.tsx). Declararla en GUARDAS_HEADER de scripts/arch/lib/nav-fuentes.ts.`
        );
    }
    const ordenados = [...literales].sort();
    return {
        literales: ordenados,
        hrefsPintados: (rol) =>
            ordenados.filter((h) => GUARDAS_HEADER[h](rol)).concat(dashboardHrefPorRol(rol)),
        hrefsLogo: hrefsLogoPorRol,
    };
}

/* ---------- Arrays de nav-items.ts + grants del seed ---------- */

export interface NavArray {
    nombre: string;
    /** Ruta del área donde vive el componente que pinta el array. */
    area: string;
    items: NavItem[];
}

/** Arrays con hrefs del menú de área y dónde se pintan (AdminNav, ComiteSubNav, ColegioNav). */
export function arraysNav(): NavArray[] {
    return [
        { nombre: "ADMIN_NAV_ITEMS", area: "/dashboard/admin", items: ADMIN_NAV_ITEMS },
        { nombre: "COMITE_NAV_TABS", area: "/dashboard/admin/comite", items: COMITE_NAV_TABS },
        { nombre: "COLEGIO_NAV_ITEMS", area: "/dashboard/colegio", items: COLEGIO_NAV_ITEMS },
    ];
}

/** IA_TABS no tiene hrefs (tabs por `key` dentro de /dashboard/admin/ia): se documenta, no se salta. */
export const NOTA_IA_TABS = `IA_TABS (${IA_TABS.length} tabs por key, sin href) no entra en la aserción B: no es un enlace.`;

/**
 * Grants de módulos por defecto (`clavesPorRol` de `prisma/seed.ts`, activo: true).
 * Roles sin entrada (PARENT) = sin módulos. Si el bloque cambia de forma, falla ruidoso.
 */
export function grantsSeedPorRol(): Record<string, string[]> {
    const texto = fs.readFileSync(RUTA_SEED, "utf-8");
    const bloque = texto.match(/clavesPorRol[^=]*=\s*\{([\s\S]*?)\};/);
    if (!bloque) {
        throw new Error("[Arch:B] no se encontró `clavesPorRol` en prisma/seed.ts (fuente de grants por defecto).");
    }
    const grants: Record<string, string[]> = {};
    for (const m of bloque[1].matchAll(/(\w+):\s*(?:modulosSeed\.map|(\[[^\]]*\]))/g)) {
        grants[m[1]] =
            m[2] === undefined
                ? CATALOGO_MODULOS.map((x) => x.clave).sort()
                : [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
    }
    if (Object.keys(grants).length === 0) {
        throw new Error("[Arch:B] `clavesPorRol` de prisma/seed.ts no se pudo interpretar (0 roles).");
    }
    return grants;
}
