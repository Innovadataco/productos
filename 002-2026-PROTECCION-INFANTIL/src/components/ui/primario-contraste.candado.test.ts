import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * SPEC-632 · CANDADO de contraste del Primario del Sistema de Diseño.
 *
 * El defecto (medido por Diseño en MAPA-CONTRASTE-AREA-PADRE-2026-09-10):
 * `.btn-ds--primary` fijaba el rótulo a `--papel-rgb`. En tema CLARO, papel es
 * casi-blanco y sobre el acento `cielo` (área del padre) daba **2.37:1** — por
 * debajo de AA (4.5:1). Eso es lo que Jelkin vio y llamó «feo».
 *
 * El arreglo (radicado): el rótulo se DERIVA del acento por tema, no se toca el
 * acento. Los acentos medio-claros (cielo) fijan `--pi-accent-ink-rgb` a un
 * rótulo oscuro; el resto usa papel (que voltea y pasa en los dos temas).
 *
 * Este candado MUERE con el defecto — verificado por mutación:
 *  · si el Primario vuelve a `color: rgb(var(--papel-rgb))` fijo → cae (A).
 *  · si `.theme-padre`/`.theme-profesional` dejan de fijar el rótulo oscuro,
 *    el acento cielo con papel vuelve a 2.37:1 → cae (C).
 *  · si `--pi-ink-oscuro-rgb` se aclara → caen (B) y (C).
 *
 * Es UNIT PURO: solo lee globals.css y calcula contraste. No necesita base.
 *
 * Método: WCAG 2.x (luminancia relativa), umbral AA texto normal = 4.5:1. Se
 * mide el rótulo contra el ACENTO PLANO (stop0 del gradiente), la misma
 * metodología del mapa de Diseño y de las «8 combinaciones» del radicado.
 * (El extremo claro del gradiente —72% acento + 28% cielo— es la FIRMA de
 * Diseño y se trata aparte; no es el rótulo.)
 */

const CSS = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf-8");

const AA = 4.5;

// ── Contraste WCAG ──────────────────────────────────────────────────────────
type RGB = [number, number, number];
const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]: RGB) =>
    0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const contraste = (a: RGB, b: RGB): number => {
    const la = luminancia(a);
    const lb = luminancia(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
};

// ── Parseo de tokens de globals.css ─────────────────────────────────────────
// Declaraciones `--token: valor;` de un bloque de texto CSS.
const declaraciones = (cuerpo: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /--([\w-]+):\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cuerpo))) out[m[1]] = m[2].trim();
    return out;
};

// Todos los bloques `:root { ... }` (hay dos: tokens base + tokens del Button),
// fusionados en el mapa CLARO. Ninguno anida llaves, así que el `}` no-greedy
// cierra cada bloque correctamente.
const bloquesRoot = [...CSS.matchAll(/:root\s*\{([\s\S]*?)\}/g)].map((x) => x[1]);
const CLARO: Record<string, string> = Object.assign(
    {},
    ...bloquesRoot.map(declaraciones),
);

// Bloque `.dark { ... }` — solo sobrescribe acentos/papel/tinta.
const darkBody = CSS.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const OSCURO: Record<string, string> = { ...CLARO, ...declaraciones(darkBody) };

// Bloques de tema `.theme-X { --... }` (solo los que fijan tokens: el `{` va
// pegado al nombre; `.theme-x .hijo {` no matchea porque hay un selector en medio).
const temas: Record<string, Record<string, string>> = {};
for (const m of CSS.matchAll(/\.theme-(\w+)\s*\{([^}]*)\}/g)) {
    const decl = declaraciones(m[2]);
    if ("accent-rgb" in decl) temas[m[1]] = decl;
}

// Resuelve un token a su triple RGB, siguiendo `var(--otro-rgb)`, buscando en los
// mapas dados en orden (rol → scope del tema).
const resolver = (
    nombre: string,
    ...mapas: Record<string, string>[]
): RGB => {
    let valor: string | undefined;
    for (const mapa of mapas) {
        if (nombre in mapa) {
            valor = mapa[nombre];
            break;
        }
    }
    if (valor === undefined) {
        throw new Error(`token --${nombre} no definido`);
    }
    const ref = valor.match(/var\(\s*--([\w-]+)/);
    if (ref) return resolver(ref[1], ...mapas);
    const trip = valor.match(/(\d+)\s+(\d+)\s+(\d+)/);
    if (!trip) throw new Error(`--${nombre} = "${valor}" no es un triple RGB`);
    return [Number(trip[1]), Number(trip[2]), Number(trip[3])];
};

// ── (A) El Primario LEE el rótulo derivado, no un color fijo ─────────────────
describe("SPEC-632 · el Primario deriva su rótulo del acento", () => {
    const bloque = CSS.slice(CSS.indexOf(".btn-ds--primary"));
    const cuerpoPrimario = bloque.slice(0, bloque.indexOf("}") + 1);

    it("el `color` del Primario se deriva de --pi-accent-ink-rgb (no papel fijo)", () => {
        expect(cuerpoPrimario).toMatch(
            /color:\s*rgb\(var\(--pi-accent-ink-rgb/,
        );
        // El bug era exactamente esto: rótulo clavado a papel.
        expect(cuerpoPrimario).not.toMatch(/color:\s*rgb\(var\(--papel-rgb\)\)\s*;/);
    });

    it("el acento NO se toca: la firma (gradiente del acento) sigue en pie", () => {
        expect(cuerpoPrimario).toMatch(/linear-gradient/);
        expect(cuerpoPrimario).toContain("--pi-accent");
    });
});

// ── (B) Las ocho combinaciones del radicado: 4 acentos × 2 temas ─────────────
// El rótulo que el Primario usa para cada acento de la paleta. ámbar como
// Primario es ámbar-ink (theme-admin; §3.2 del Sistema — el ámbar crudo no se
// usa como relleno sólido de botón, eso es el barrido de SPEC-633 → <Button>).
const COMBOS: { acento: string; fill: string; ink: string }[] = [
    { acento: "pino", fill: "pino-rgb", ink: "papel-rgb" },
    { acento: "cielo", fill: "cielo-rgb", ink: "pi-ink-oscuro-rgb" },
    { acento: "ámbar", fill: "ambar-ink-rgb", ink: "papel-rgb" },
    { acento: "rubí", fill: "rubi-rgb", ink: "papel-rgb" },
];

describe("SPEC-632 · AA del Primario con los cuatro acentos, en los dos temas", () => {
    for (const tema of ["claro", "oscuro"] as const) {
        const scope = tema === "claro" ? CLARO : OSCURO;
        for (const { acento, fill, ink } of COMBOS) {
            it(`${acento} · ${tema}: rótulo sobre acento ≥ ${AA}:1`, () => {
                const c = contraste(resolver(ink, scope), resolver(fill, scope));
                expect(c).toBeGreaterThanOrEqual(AA);
            });
        }
    }
});

// ── (C) Guarda de rol/acento nuevo ──────────────────────────────────────────
// Barre TODO rol que fije --accent-rgb (default + cada .theme-*) y exige que el
// Primario de ese rol pase AA en ambos temas. Un rol nuevo con un acento
// medio-claro que no fije su rótulo oscuro cae aquí (fallback papel → falla).
describe("SPEC-632 · guarda: todo rol resuelve a un Primario que cumple AA", () => {
    const roles: { nombre: string; mapa: Record<string, string> }[] = [
        { nombre: "default (:root)", mapa: {} }, // usa accent-rgb/pi-accent-ink del :root
        ...Object.entries(temas).map(([nombre, mapa]) => ({
            nombre: `theme-${nombre}`,
            mapa,
        })),
    ];

    it("hay al menos los roles conocidos (default + colegio/padre/admin/profesional)", () => {
        expect(roles.length).toBeGreaterThanOrEqual(5);
        expect(Object.keys(temas).sort()).toEqual(
            expect.arrayContaining(["admin", "colegio", "padre", "profesional"]),
        );
    });

    for (const { nombre, mapa } of roles) {
        for (const tema of ["claro", "oscuro"] as const) {
            const scope = tema === "claro" ? CLARO : OSCURO;
            it(`${nombre} · ${tema}: rótulo del Primario ≥ ${AA}:1`, () => {
                const acento = resolver("accent-rgb", mapa, scope);
                const ink = resolver("pi-accent-ink-rgb", mapa, scope);
                expect(contraste(ink, acento)).toBeGreaterThanOrEqual(AA);
            });
        }
    }
});
