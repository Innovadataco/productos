/**
 * SPEC-483b (Lote-2 fase 2 · Diseño) · Candado del barrido residual del panel de IA + monitoreo.
 *
 * Migró a tokens el crudo NO-data-viz del panel de IA (`IaPlayground`,
 * `IaModelSelector`, `RubricaTab`, `IaTraceTimeline`, `IaDocsPanel` chrome,
 * `simulacion/*`) y `monitoreo/LogsTab`:
 *   - `sky/cyan` → cielo · `emerald`/`green` (éxito) → pino / `text-estado-pino`.
 *   - `slate/gray` → neutros (tinta/papel/`.text-muted`).
 *   - `red` (error/regresión) → rubi / `text-estado-rubi` · `amber` → `text-estado-ambar`.
 *
 * REGLA DE ORO (Diseño): un color que CODIFICA un valor (gauge/escala/heatmap)
 * NO se tokeniza a ciegas — se marca y lo hace Diseño. El único caso acá es el
 * **medidor de confianza de `IaDocsPanel`** (el color del arco depende de
 * `confianza >= umbral`): queda crudo, envuelto en una región `data-viz:inicio`
 * … `data-viz:fin`, para la pasada dedicada de Diseño. El candado exime esa
 * región y vigila TODO lo demás.
 *
 * Conducta: 0 crudo fuera de las regiones data-viz. Verificado por mutación:
 * reintroducir un `bg-slate-50` / `text-red-600` en cualquier archivo (fuera del
 * gauge) hace caer el candado; y el marcador del gauge debe seguir presente.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname, "..");
const DIR_IA = path.join(MODULES, "ia");
const LOGS_TAB = path.join(MODULES, "monitoreo", "LogsTab.tsx");
const SRC = path.resolve(__dirname, "../../..");

function* recorrer(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

const CRUDO = /-(slate|gray|sky|cyan|emerald|red|green|amber)-[0-9]{2,3}(\/[0-9]{1,3})?\b/;

/** Líneas fuera de las regiones marcadas `data-viz:inicio` … `data-viz:fin`. */
function lineasVigiladas(codigo: string): { n: number; linea: string }[] {
    const out: { n: number; linea: string }[] = [];
    let enDataViz = false;
    codigo.split("\n").forEach((linea, i) => {
        if (linea.includes("data-viz:inicio")) enDataViz = true;
        if (!enDataViz) out.push({ n: i + 1, linea });
        if (linea.includes("data-viz:fin")) enDataViz = false;
    });
    return out;
}

describe("SPEC-483b · barrido residual del panel de IA + monitoreo", () => {
    it("0 crudo fuera de las regiones data-viz (gauge de confianza exento)", () => {
        const archivos = [...recorrer(DIR_IA), LOGS_TAB];
        const hits: string[] = [];
        for (const archivo of archivos) {
            const codigo = fs.readFileSync(archivo, "utf-8");
            for (const { n, linea } of lineasVigiladas(codigo)) {
                const m = linea.match(CRUDO);
                if (m) {
                    const rel = path.relative(SRC, archivo);
                    hits.push(`${rel}:${n} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(hits, `crudo reintroducido fuera de data-viz:\n${hits.join("\n")}`).toEqual([]);
    });

    it("el gauge de confianza de IaDocsPanel sigue marcado como data-viz (no tokenizado a ciegas)", () => {
        const docs = fs.readFileSync(path.join(DIR_IA, "IaDocsPanel.tsx"), "utf-8");
        expect(docs, "falta el marcador data-viz:inicio del medidor de confianza").toContain("data-viz:inicio");
        expect(docs, "falta el marcador data-viz:fin del medidor de confianza").toContain("data-viz:fin");
    });
});
