import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Disciplina Spec-Kit (spec 087-US5): corre en el gate (`npm run test`).
 * Falla si: Status fuera del catálogo canónico, spec CERRADA (>021) sin cierre,
 * número de carpeta duplicado, o índice specs/README.md inconsistente con las carpetas.
 */

const SPECS_DIR = path.resolve(__dirname, "../../specs");
const STATUS_CANONICOS = new Set([
    "PLANEADO",
    "DESARROLLO",
    "IMPLEMENTADO",
    "PENDIENTE DE PRUEBA",
    "FINALIZADO",
    "CERRADA",
]);

/**
 * SPEC-107 (cola 025, B3): specs históricas incompletas (sin plan.md y/o tasks.md) a la
 * fecha de activación de esta regla. La lista SOLO PUEDE ENCOGER, NUNCA CRECER:
 * toda spec nueva o fuera de esta lista DEBE tener plan.md y tasks.md o el gate falla.
 * Para sacar una spec de la lista hay que completar sus artefactos (backfill), no borrarla.
 */
const DEUDA_HEREDADA = new Set([
    "009-dashboard-publico",
    "011-centro-control-ia",
    "012-baja-reportes",
    "013-admin-motor-ia",
    "014-laboratorio-ia",
    "015-anti-abuso",
    "017-documentacion",
    "018-operadores-casos",
    "022-expediente-transiciones",
    "023-estados-usuario-sla",
    "024-comite-validacion",
    "025-anonimizacion-reforzada",
    "026-pipeline-spam-prioridad",
    "027-motor-encolamiento",
    "028-redisenio-home",
    "029-redisenio-consulta-panel-usuario",
    "030-circulo-confianza-multiples-identificadores",
    "031-mejoras-ui-agrupacion-categorias",
    "088-pendientes-afinamiento",
]);

/**
 * SPEC-126 (US3, FR-008): toda spec NUEVA (numeración >= 126) DEBE declarar su
 * "Impacto en arquitectura:" en spec.md. Las históricas (< 126) quedan fuera por
 * número; esta lista es para excepciones explícitas dentro de las nuevas y, como
 * DEUDA_HEREDADA, SOLO PUEDE ENCOGER (hoy está vacía y el tope duro es 0).
 */
const SIN_IMPACTO_HEREDADO = new Set<string>([]);
const DESDE_SPEC_IMPACTO = 126;

function carpetasSpecs(): string[] {
    return fs
        .readdirSync(SPECS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
}

function statusDe(specPath: string): string | null {
    const contenido = fs.readFileSync(specPath, "utf-8");
    const m = contenido.match(/(?:Status|Estado)\**[:：]\s*\*?\*?`?([A-ZÁÉÍÓÚa-z][A-ZÁÉÍÓÚa-z ]*?)(?:`|\*|$|\(|\||\.)/m);
    return m ? m[1].trim() : null;
}

const carpetas = carpetasSpecs().filter((d) => fs.existsSync(path.join(SPECS_DIR, d, "spec.md")));

describe("disciplina Spec-Kit (spec 087)", () => {
    it("toda spec declara Status del catálogo canónico", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const status = statusDe(path.join(SPECS_DIR, carpeta, "spec.md"));
            if (!status || !STATUS_CANONICOS.has(status)) {
                violaciones.push(`${carpeta}: "${status ?? "sin Status"}"`);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("specs CERRADA tienen cierre (carpeta o docs/) — SIN exenciones (auditoría §3.2a)", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const num = parseInt(carpeta.split("-")[0], 10);
            if (Number.isNaN(num)) continue;
            const status = statusDe(path.join(SPECS_DIR, carpeta, "spec.md"));
            if (status !== "CERRADA") continue;
            const archivos = fs.readdirSync(path.join(SPECS_DIR, carpeta));
            const tieneCierrePropio = archivos.some((f) => /cierre/i.test(f));
            const cierreEnDocs = fs.existsSync(path.resolve(SPECS_DIR, "../docs", `cierre-${carpeta.split("-")[0]}.md`));
            if (!tieneCierrePropio && !cierreEnDocs) {
                violaciones.push(carpeta);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("no hay números de carpeta duplicados", () => {
        const numeros = new Map<string, string[]>();
        for (const carpeta of carpetas) {
            const num = carpeta.split("-")[0];
            numeros.set(num, [...(numeros.get(num) ?? []), carpeta]);
        }
        const duplicados = [...numeros.entries()].filter(([, v]) => v.length > 1);
        expect(duplicados.map(([n, v]) => `${n}: ${v.join(" vs ")}`)).toEqual([]);
    });

    it("toda spec tiene plan.md y tasks.md (salvo DEUDA_HEREDADA, que solo encoge)", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            if (DEUDA_HEREDADA.has(carpeta)) continue;
            const archivos = fs.readdirSync(path.join(SPECS_DIR, carpeta));
            const faltan = ["plan.md", "tasks.md"].filter((f) => !archivos.includes(f));
            if (faltan.length > 0) {
                violaciones.push(`${carpeta}: falta ${faltan.join(" y ")}`);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("DEUDA_HEREDADA no crece (tope duro: añadir una entrada pone la suite en rojo)", () => {
        // Auditoría §3.2b: la lista SOLO PUEDE ENCOGER. Tope duro en el valor actual (19);
        // al sanear una spec (completar sus artefactos) se baja el tope a mano en el mismo commit.
        expect(DEUDA_HEREDADA.size).toBeLessThanOrEqual(19);
        // Consistencia: toda carpeta de la lista sigue existiendo (si se sana una spec, hay
        // que sacarla de la lista, no borrar la carpeta).
        const inexistentes = [...DEUDA_HEREDADA].filter((c) => !carpetas.includes(c));
        expect(inexistentes, inexistentes.join("; ")).toEqual([]);
    });

    it("toda spec nueva (>= 126) declara 'Impacto en arquitectura:' (SPEC-126, FR-008)", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const num = parseInt(carpeta.split("-")[0], 10);
            if (Number.isNaN(num) || num < DESDE_SPEC_IMPACTO) continue;
            if (SIN_IMPACTO_HEREDADO.has(carpeta)) continue;
            const contenido = fs.readFileSync(path.join(SPECS_DIR, carpeta, "spec.md"), "utf-8");
            if (!contenido.includes("Impacto en arquitectura:")) {
                violaciones.push(`${carpeta}: falta la línea "Impacto en arquitectura:"`);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("SIN_IMPACTO_HEREDADO no crece (tope duro 0: eximir una spec nueva pone la suite en rojo)", () => {
        expect(SIN_IMPACTO_HEREDADO.size).toBeLessThanOrEqual(0);
        const inexistentes = [...SIN_IMPACTO_HEREDADO].filter((c) => !carpetas.includes(c));
        expect(inexistentes, inexistentes.join("; ")).toEqual([]);
    });

    // SPEC-487 (D-109): el índice specs/README.md ya NO se compara con las carpetas
    // en el PR —eso obligaba a cada PR a editar el índice (clase de conflicto union)—;
    // lo regenera el barrido post-merge. Acá se vigila la REPRESENTABILIDAD de la
    // fuente: ninguna carpeta de spec a medio crear (sin spec.md). Que el índice
    // committeado esté al día lo garantiza el barrido, no el PR.
    it("ninguna carpeta specs/NNN queda a medio crear (sin spec.md) — representabilidad (SPEC-487)", () => {
        const sinSpec = fs
            .readdirSync(SPECS_DIR, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .filter((c) => !fs.existsSync(path.join(SPECS_DIR, c, "spec.md")));
        expect(sinSpec, sinSpec.join("; ")).toEqual([]);
    });
});
