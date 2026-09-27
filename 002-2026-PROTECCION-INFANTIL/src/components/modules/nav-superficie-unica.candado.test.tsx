/**
 * CANDADO (A)+(C) · SPEC-744 · Ninguna superficie de nav se sale de la fuente única.
 *
 * La causa que cazó Jelkin: NavHeader tenía la nav ESCRITA A MANO por rol (el padre
 * STALE, distinta de PADRE_NAV_ITEMS). Dos fuentes → desincronización → recurre. Este
 * candado la cierra en la capa de las SUPERFICIES:
 *
 *  (C) BARRIDO ANTI-QUEMADO — ninguna superficie de nav lleva un destino de rol escrito
 *      a mano; todos salen de `navParaRol`. El descubridor de superficies es por
 *      CONVENCIÓN, no una lista a mano (para no repetir «el candado contra listas a mano
 *      nació siendo una lista»): una superficie es un componente que (i) importa el
 *      resolver, o (ii) pinta ≥2 destinos de nav literales. El conjunto de «destinos de
 *      nav» se DERIVA de `@/lib/nav-items`, no se enumera.
 *
 *  (A) PROPAGACIÓN POR CENTINELA — cada superficie que lee la fuente REFLEJA lo que la
 *      fuente devuelve: se mockea `navParaRol` a un ítem centinela y se renderiza cada
 *      superficie; el centinela debe aparecer. Una superficie con lista a mano no lo
 *      reflejaría (control positivo). La cobertura de (A) SALE DEL MISMO DESCUBRIDOR que
 *      (C): un componente nuevo que importe el resolver y no tenga prueba de propagación
 *      rompe la meta-aserción.
 *
 * CAVEAT (orden del CEO): esto es VISIBILIDAD, no ACCESO. Un verde acá NO significa que
 * las páginas estén cerradas — los guardias server-side son otra cosa, intactos.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
    ADMIN_NAV_ITEMS,
    COLEGIO_NAV_ITEMS,
    COMITE_COLEGIO_NAV_ITEMS,
    PADRE_NAV_ITEMS,
    PROFESIONAL_NAV_ITEMS,
} from "@/lib/nav-items";

const RAIZ = path.resolve(__dirname, "../../..");
const SENT_HREF = "/centinela-744";
const SENT_LABEL = "CENTINELA-744";

// ── El descubridor (compartido por (A) y (C)) ───────────────────────────────────────
// El conjunto de destinos de nav se DERIVA de la fuente (no es una lista a mano).
function recolectarHrefs(items: ReadonlyArray<{ href: string; children?: ReadonlyArray<{ href: string; children?: unknown }> }>, acc: Set<string>): Set<string> {
    for (const i of items) {
        if (i.href && i.href !== "#") acc.add(i.href);
        if (i.children) recolectarHrefs(i.children as never, acc);
    }
    return acc;
}
// Destinos del MENÚ DE ROL (las áreas autenticadas). NO se incluye la superficie anónima
// («/dashboard-publico»): esa es contenido público legítimo en muchos lugares (footer,
// landing) y su presencia en el HEADER ya la exige (A). Aquí cazamos el menú de rol quemado.
const DESTINOS_NAV = recolectarHrefs(
    [
        ...ADMIN_NAV_ITEMS,
        ...COLEGIO_NAV_ITEMS,
        ...COMITE_COLEGIO_NAV_ITEMS,
        ...PADRE_NAV_ITEMS,
        ...PROFESIONAL_NAV_ITEMS,
    ],
    new Set<string>(),
);

/** Destinos de nav escritos a mano como `href="..."` (literal) en un contenido. */
function hrefsQuemados(contenido: string): string[] {
    const encontrados = new Set<string>();
    const re = /href=\{?["'`]([^"'`{}]+)["'`]\}?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(contenido)) !== null) {
        if (DESTINOS_NAV.has(m[1])) encontrados.add(m[1]);
    }
    return [...encontrados];
}
function importaResolver(contenido: string): boolean {
    return /from\s+["']@\/lib\/nav\/para-rol["']/.test(contenido);
}

function listarComponentes(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listarComponentes(p));
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

/**
 * Superficie de nav POR CONVENCIÓN (no allowlist): un componente que importa el resolver,
 * o que pinta su navegación dentro de un elemento `<nav>` (la marca semántica de «esto es
 * navegación»). Contenido con CTAs contextuales sueltos —sin `<nav>` y sin resolver— NO es
 * superficie (p. ej. ComiteHome, EsperaCitaPanel): son enlaces de contenido, no un menú.
 *
 * LÍMITE ACEPTADO (CEO, verdict #698): una nav pintada en un `<div>` plano —sin `<nav>` y
 * sin importar el resolver— escapa al descubridor. Es un límite consciente: la convención de
 * accesibilidad de este código es envolver la navegación en `<nav>`; salirse de ella para
 * quemar una nav es una desviación deliberada, no un olvido que el candado deba atrapar.
 */
function esSuperficieDeNav(contenido: string): boolean {
    return importaResolver(contenido) || /<nav[\s/>]/.test(contenido);
}

type Superficie = { rel: string; quemados: string[]; importa: boolean };
function descubrirSuperficies(): Superficie[] {
    const superficies: Superficie[] = [];
    for (const archivo of listarComponentes(path.join(RAIZ, "src/components"))) {
        const contenido = fs.readFileSync(archivo, "utf-8");
        if (!esSuperficieDeNav(contenido)) continue;
        superficies.push({
            rel: path.relative(RAIZ, archivo).replace(/\\/g, "/"),
            quemados: hrefsQuemados(contenido),
            importa: importaResolver(contenido),
        });
    }
    return superficies;
}

describe("SPEC-744 (C) · ninguna superficie de nav quema destinos de rol", () => {
    it("todas las superficies descubiertas sacan la nav de navParaRol (cero destinos a mano)", () => {
        const ofensoras = descubrirSuperficies().filter((s) => s.quemados.length > 0);
        expect(
            ofensoras.map((s) => `${s.rel} → ${s.quemados.join(", ")}`),
            "Estas superficies queman destinos de nav; deben salir de navParaRol (SPEC-744).",
        ).toEqual([]);
    });

    it("CONTROL POSITIVO del descubridor: caza una superficie NUEVA con lista a mano (por convención, sin allowlist)", () => {
        const falsa = `
            import Link from "next/link";
            export function BarraFalsa() {
                return (
                    <nav>
                        <Link href="${ADMIN_NAV_ITEMS[0].href}">Uno</Link>
                        <Link href="${ADMIN_NAV_ITEMS[1].href}">Dos</Link>
                    </nav>
                );
            }`;
        // No importa el resolver, pero pinta nav en un <nav> → el descubridor la toma…
        expect(importaResolver(falsa)).toBe(false);
        expect(esSuperficieDeNav(falsa), "un <nav> con destinos de rol ES superficie").toBe(true);
        // …y (C) la marcaría como ofensora (tiene destinos de rol quemados).
        expect(hrefsQuemados(falsa)).toContain(ADMIN_NAV_ITEMS[0].href);
    });

    it("CONTROL NEGATIVO: contenido con CTAs contextuales (sin <nav> ni resolver) NO es superficie", () => {
        // El molde de ComiteHome/EsperaCitaPanel: enlaces de contenido, no un menú.
        const contenido = `export default function P(){ return (
            <div>
                <a href="${PADRE_NAV_ITEMS[1].href}">a</a>
                <a href="${PADRE_NAV_ITEMS[2].href}">b</a>
            </div>); }`;
        expect(importaResolver(contenido)).toBe(false);
        expect(esSuperficieDeNav(contenido), "contenido sin <nav> no es superficie").toBe(false);
    });
});

// ── (A) Propagación por centinela ────────────────────────────────────────────────────
let mockPathname = "/x";
const authRef: { value: unknown } = { value: { user: null } };

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => authRef.value }));
vi.mock("@/lib/nav/para-rol", () => ({
    navParaRol: () => [{ href: SENT_HREF, label: SENT_LABEL, iconKey: SENT_HREF }],
    navMovilParaRol: () => ({ principales: [{ href: SENT_HREF, label: SENT_LABEL, iconKey: SENT_HREF }], resto: [] }),
    aplanar: (items: Array<{ href: string; label: string; children?: unknown[] }>) =>
        items.flatMap((i) => (i.children && (i.children as unknown[]).length > 0 ? (i.children as typeof items) : [i])),
}));
vi.mock("@/components/ui/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/ui/Tooltip", () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/ui/Guardian", () => ({ Guardian: () => null }));

import { NavLateral } from "./nav/NavLateral";
import { BarraInferior } from "./nav/BarraInferior";
import { HojaMas } from "./nav/HojaMas";
import { NavHeader } from "./NavHeader";

const enlaceCentinela = () => screen.getByText(SENT_LABEL).closest("a")?.getAttribute("href");

/** Cada superficie que lee la fuente y cómo probar que refleja el centinela. */
const SUPERFICIES_CUBIERTAS: Array<{ rel: string; render: () => void }> = [
    {
        // SPEC-744: la lateral única reemplaza AdminNav/ColegioSideNav/PadreSideNav.
        rel: "src/components/modules/nav/NavLateral.tsx",
        render: () => {
            authRef.value = { user: { rol: "ADMIN" }, isLoading: false };
            render(<NavLateral rol="ADMIN" modulosPermitidos={[]} />);
        },
    },
    {
        // SPEC-744: la barra móvil única (reemplaza PadreNavMovil), por rol con módulos.
        rel: "src/components/modules/nav/BarraInferior.tsx",
        render: () => {
            authRef.value = { user: { rol: "PARENT" }, isLoading: false };
            render(<BarraInferior rol="PARENT" modulosPermitidos={[]} />);
        },
    },
    {
        // La hoja «Más» refleja el `resto` que recibe; el centinela va como ítem del resto.
        rel: "src/components/modules/nav/HojaMas.tsx",
        render: () => {
            render(<HojaMas resto={[{ href: SENT_HREF, label: SENT_LABEL, iconKey: SENT_HREF }]} activo={() => false} onCerrar={() => {}} />);
        },
    },
    {
        rel: "src/components/modules/NavHeader.tsx",
        render: () => {
            // Anónimo: la superficie pública del header refleja navParaRol(null).
            authRef.value = { user: null, isLoading: false };
            render(<NavHeader />);
        },
    },
];

describe("SPEC-744 (A) · cada superficie refleja la fuente (propagación por centinela)", () => {
    beforeEach(() => {
        cleanup();
        mockPathname = "/x";
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ noLeidas: 0 }), { status: 200 })));
    });

    for (const sup of SUPERFICIES_CUBIERTAS) {
        it(`${sup.rel} pinta lo que devuelve navParaRol`, () => {
            sup.render();
            expect(enlaceCentinela(), `${sup.rel} debe reflejar el ítem de la fuente`).toBe(SENT_HREF);
        });
    }

    // SPEC-744 (retiro de la hamburguesa): el header del LOGUEADO ya NO pinta nav de rol —
    // es marca (logo) + avatar de CUENTA. La nav vive en NavLateral (escritorio) / BarraInferior
    // (móvil) por rol. El riesgo histórico era el doble-menú de Jelkin (avatar + hamburguesa);
    // retirada la hamburguesa, el lock que queda es: el avatar NO pinta nav source-driven — si lo
    // hiciera, el centinela (salida de navParaRol) aparecería al abrirlo. (La superficie ANÓNIMA
    // sí sigue en el header y su reflejo lo cubre SUPERFICIES_CUBIERTAS arriba.)
    it("el header del logueado es marca + avatar de cuenta: sin hamburguesa y sin nav en el avatar", () => {
        authRef.value = { user: { rol: "PARENT", nombre: "P", email: "p@x.co" }, isLoading: false, logout: vi.fn() };
        render(<NavHeader />);
        // Sin hamburguesa (retiro final SPEC-744).
        expect(screen.queryByLabelText("Menú"), "el logueado no tiene hamburguesa").toBeNull();
        // El avatar abre a CUENTA; no pinta nav (centinela ausente).
        fireEvent.click(screen.getByLabelText("Menú de usuario"));
        expect(screen.getByText("Cerrar sesión"), "el avatar abrió (es la cuenta)").toBeTruthy();
        expect(
            screen.queryByText(SENT_LABEL),
            "el avatar es SOLO cuenta: si pintara nav source-driven recaería en el doble-menú de Jelkin",
        ).toBeNull();
    });

    it("CONTROL POSITIVO: una barra que NO usa navParaRol no refleja el centinela", () => {
        function BarraQuemada() {
            return (
                <nav>
                    <a href={ADMIN_NAV_ITEMS[0].href}>Inicio</a>
                </nav>
            );
        }
        render(<BarraQuemada />);
        expect(screen.queryByText(SENT_LABEL)).toBeNull();
    });

    it("COBERTURA: cada superficie que importa el resolver tiene su prueba de propagación (enumeración por descubridor, no a mano)", () => {
        const importadoras = descubrirSuperficies()
            .filter((s) => s.importa)
            .map((s) => s.rel)
            .sort();
        const cubiertas = [...new Set(SUPERFICIES_CUBIERTAS.map((s) => s.rel))].sort();
        expect(importadoras, "hay una superficie que lee navParaRol sin prueba de propagación (A)").toEqual(cubiertas);
    });
});
