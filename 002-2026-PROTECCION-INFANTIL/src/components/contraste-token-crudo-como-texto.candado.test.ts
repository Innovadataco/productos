/**
 * CANDADO · SPEC-880 (barrido codebase-wide de contraste · CLASE A) — `text-cielo`/`text-ambar`
 * CRUDOS como TEXTO no vuelven. Es la costura que SPEC-876 dejó y SUBSUME el candado de archivo de
 * SPEC-879 (los 2 archivos del lote: EsperaCitaPanel + ProfesionalTarjeta).
 *
 * Medido por Diseño (FORMA-BARRIDO-TOKENS-CRUDOS-COMO-TEXTO-SPEC880, prod 35310137):
 *  - `text-cielo` (#5aa2ea) como texto FALLA AA a CUALQUIER tamaño (2.37 papel / 2.19 teñido; ni 3:1).
 *  - `text-ambar` (#a9700c) como texto CHICO falla 4.5 (3.69); GRANDE (≥18px / ≥14px-negrita) pasa 3:1.
 * Clave: ambos fallan sobre TODOS los fondos claros → la detección **NO necesita mirar el fondo**
 * (cubre la «forma 1» plano Y la «forma 2» padre-teñido). El fix es `text-estado-cielo`/`text-estado-ambar`
 * (variantes «ink» mode-aware: 5.76/5.11 claro, 11.40/10.72 oscuro), SOLO en el camino de TEXTO —
 * `bg-`/`border-` NO se tocan. `rubi` queda FUERA (su ink == el crudo). `pino` depende del fondo
 * (solo falla en pino/15+ chico) → no entra a este candado sin-fondo (se arregló caso a caso).
 *
 * ESTRUCTURAL (no render): escanea el texto fuente de `src/**` (incluye constantes de mapa tipo
 * `estado: "text-ambar"`, no solo `className=`) y marca ROJO cada `text-cielo`/`text-ambar` CRUDO
 * (no `dark:`, no `text-estado-*`, no escala `-NNN`). Exentos, con su razón y ratio AUDITADOS (no a
 * dedo): data-viz en `<svg>` currentColor, decorativos `aria-hidden`, ámbar GRANDE/ícono-UI (3:1), y
 * —temporal— los 2 archivos de SPEC-879 hasta reconciliar. Una entrada de la allowlist que ya no
 * aparezca pone el candado ROJO (se limpia sola); un crudo nuevo fuera de la allowlist, también.
 *
 * Muere con el defecto: revertir cualquier `text-estado-cielo`/`-ambar` a crudo en una línea no
 * exenta reenciende el candado (control positivo sintético incluido abajo, sin depender de mutar
 * el árbol).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const SRC = resolve(__dirname, ".."); // src/components → src

/** Crudo = text-cielo|text-ambar NO precedido por `dark:` ni `estado-`, NO parte de identificador, NO escala `-NNN`. */
const CRUDO = /(?<!dark:)(?<!estado-)(?<![-\w])text-(cielo|ambar)(?![-\w])/g;

/** Archivos eximidos ENTEROS (relativos a src/), con su razón. */
const ARCHIVOS_EXENTOS: Record<string, string> = {
    // Data-viz: el token tiñe un <svg> por `currentColor` (trazo/relleno), NO es texto. Gobierna §7.9.
    "components/modules/Sparkline.tsx": "data-viz · <svg> currentColor (§7.9, no es texto)",
    "components/modules/BarChart.tsx": "data-viz · <svg> currentColor (§7.9, no es texto)",
    // SPEC-879 (Dev 1) arregla el camino de texto de estos 2 archivos en su propio PR con candado de
    // archivo. Exención TEMPORAL: al mergear 879 estas quedan `text-estado-*` y la entrada se retira
    // (reconciliación — mi candado las cubre entonces como al resto del codebase).
    "components/modules/padre/citas/EsperaCitaPanel.tsx": "SPEC-879 (reconciliar: retirar al mergear 879)",
    "components/modules/padre/profesionales/ProfesionalTarjeta.tsx": "SPEC-879 (reconciliar: retirar al mergear 879)",
};

/** Exentos por OCURRENCIA: el crudo se queda porque pasa su umbral o no es texto. `contiene` es un
 *  fragmento distintivo de la línea; `ratio` es el contraste medido (claro) que lo justifica. */
interface Exento {
    file: string; // relativo a src/
    contiene: string;
    token: "cielo" | "ambar";
    razon: string;
    ratio: string;
}
const ALLOWLIST: Exento[] = [
    // — Ámbar GRANDE (≥18px / ≥14px-negrita): pasa 3:1 (3.69). Diseño lo deja (la tinta cálida es la forma). —
    { file: "components/modules/padre/ResumenCirculo.tsx", contiene: "text-2xl font-bold text-ambar", token: "ambar", razon: "cifra grande (text-2xl bold)", ratio: "3.69 (≥3:1 grande)" },
    { file: "components/modules/colegio/home/QueHacerHoyCard.tsx", contiene: "text-base font-semibold", token: "ambar", razon: "título h2 (base semibold ≥14 negrita)", ratio: "3.69 (≥3:1 grande)" },
    { file: "components/modules/cliente/suscripcion/SuscripcionAcciones.tsx", contiene: "font-semibold text-ambar", token: "ambar", razon: "aviso prominente (base semibold)", ratio: "3.69 (≥3:1 grande)" },
    { file: "components/modules/pagos/EsperandoAutorizacion.tsx", contiene: "font-semibold text-ambar", token: "ambar", razon: "dato prominente (base semibold)", ratio: "3.69 (≥3:1 grande)" },
    { file: "components/modules/monitoreo/SemaforoCard.tsx", contiene: 'texto: "text-ambar"', token: "ambar", razon: "etiqueta semáforo, se pinta text-lg bold (ver :77)", ratio: "3.69 (≥3:1 grande)" },
    { file: "components/modules/padre/ExpedienteMadreClient.tsx", contiene: 'titulo: "text-ambar"', token: "ambar", razon: "título de severidad, se pinta en <b> text-sm (≥14 negrita, :228)", ratio: "3.69 (≥3:1 grande)" },
    // — Ícono que informa (3:1) y controles de formulario (checkbox): no es texto de párrafo. —
    { file: "components/modules/padre/ExpedienteMadreClient.tsx", contiene: '? "text-ambar"', token: "ambar", razon: "color de ícono de severidad (h-3.5)", ratio: "3.69 (≥3:1 ícono)" },
    { file: "components/modules/notificaciones/ReglasTab.tsx", contiene: "border-tinta/30 text-ambar", token: "ambar", razon: "acento de checkbox (control UI)", ratio: "3.69 (≥3:1 UI)" },
    { file: "components/modules/notificaciones/PlantillasTab.tsx", contiene: "border-tinta/30 text-ambar", token: "ambar", razon: "acento de checkbox (control UI)", ratio: "3.69 (≥3:1 UI)" },
    // — Decorativos aria-hidden (WCAG los exime). —
    { file: "components/modules/ConsultaVaciaBloque.tsx", contiene: 'aria-hidden="true" className="mt-0.5 text-ambar"', token: "ambar", razon: "viñeta ● decorativa (aria-hidden)", ratio: "exento (decorativo)" },
    { file: "components/modules/padre/circulo/BloqueAtencion.tsx", contiene: 'stroke="currentColor"', token: "ambar", razon: "ícono svg decorativo en <span aria-hidden>", ratio: "exento (decorativo)" },
    { file: "components/modules/padre/profesionales/ProfesionalPerfil.tsx", contiene: "text-cielo dark:text-cielo text-2xl", token: "cielo", razon: "iniciales de avatar decorativo (aria-hidden, :74)", ratio: "exento (decorativo)" },
];

function archivosFuente(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
            if (e === "node_modules" || e === ".next") continue;
            archivosFuente(p, out);
        } else if ((e.endsWith(".tsx") || e.endsWith(".ts")) && !e.includes(".test.") && !e.includes(".candado.")) {
            out.push(p);
        }
    }
    return out;
}

interface Violacion { file: string; linea: number; token: string; texto: string; }

/** Pura: devuelve los crudos NO exentos de un archivo, y marca qué entradas de la allowlist usó. */
function escanear(fileRel: string, contenido: string, usadas: Set<number>): Violacion[] {
    if (fileRel in ARCHIVOS_EXENTOS) return [];
    const viol: Violacion[] = [];
    const lineas = contenido.split("\n");
    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        for (const m of linea.matchAll(CRUDO)) {
            const token = m[1] as "cielo" | "ambar";
            const idx = ALLOWLIST.findIndex((a) => a.file === fileRel && a.token === token && linea.includes(a.contiene));
            if (idx === -1) {
                viol.push({ file: fileRel, linea: i + 1, token, texto: linea.trim().slice(0, 90) });
            } else {
                usadas.add(idx);
            }
        }
    }
    return viol;
}

describe("SPEC-880 · text-cielo/text-ambar crudos como TEXTO no vuelven (CLASE A)", () => {
    const usadas = new Set<number>();
    const violaciones: Violacion[] = [];
    for (const abs of archivosFuente(SRC)) {
        const rel = relative(SRC, abs);
        violaciones.push(...escanear(rel, readFileSync(abs, "utf-8"), usadas));
    }

    it("ningún text-cielo/text-ambar crudo fuera de la allowlist auditada", () => {
        expect(
            violaciones,
            "token crudo como texto (cielo <3:1 a todo tamaño; ámbar chico <4.5) — usar text-estado-*:\n  " +
                violaciones.map((v) => `${v.file}:${v.linea} [${v.token}] «${v.texto}»`).join("\n  "),
        ).toEqual([]);
    });

    it("la allowlist no tiene entradas obsoletas (cada exento sigue existiendo)", () => {
        const obsoletas = ALLOWLIST.map((a, j) => ({ a, j })).filter(({ j }) => !usadas.has(j)).map(({ a }) => `${a.file} «${a.contiene}»`);
        expect(obsoletas, `entradas de allowlist que ya no casan (retirarlas):\n  ${obsoletas.join("\n  ")}`).toEqual([]);
    });

    it("control positivo: un crudo como texto NO exento se detecta (el candado no es vacuo)", () => {
        const u = new Set<number>();
        const defecto = escanear("components/Fulano.tsx", '<p className="text-sm text-cielo">hola</p>', u);
        expect(defecto.length, "un text-cielo crudo de párrafo debe marcarse").toBe(1);
        // y el fix NO se marca
        const fix = escanear("components/Fulano.tsx", '<p className="text-sm text-estado-cielo">hola</p>', new Set());
        expect(fix.length, "text-estado-cielo (el fix) no se marca").toBe(0);
        // dark: tampoco (pasa en oscuro)
        const dark = escanear("components/Fulano.tsx", '<p className="dark:text-cielo">x</p>', new Set());
        expect(dark.length, "dark:text-cielo no se marca").toBe(0);
    });
});
