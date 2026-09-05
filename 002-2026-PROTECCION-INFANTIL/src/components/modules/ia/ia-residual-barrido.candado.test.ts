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

// La forma con guion inicial `-(familia)-N` captura también las variantes
// direccionales (`border-l-emerald`, `border-b-…`) — no solo `text/bg/border-`.
const CRUDO = /-(slate|gray|sky|cyan|emerald|red|green|amber)-[0-9]{2,3}(\/[0-9]{1,3})?\b/;

describe("SPEC-483b · barrido residual del panel de IA + monitoreo", () => {
    // SPEC-489: el medidor de confianza de IaDocsPanel se tokenizó (ya no es una
    // región data-viz cruda reservada); por eso el candado escanea TODO ia/**,
    // sin exención. La escala del ring la vigila su propio candado (SPEC-489).
    it("ia/** + monitoreo/LogsTab no traen crudo slate/gray/sky/cyan/emerald/red/green/amber", () => {
        const archivos = [...recorrer(DIR_IA), LOGS_TAB];
        const hits: string[] = [];
        for (const archivo of archivos) {
            const codigo = fs.readFileSync(archivo, "utf-8");
            for (const [i, linea] of codigo.split("\n").entries()) {
                const m = linea.match(CRUDO);
                if (m) {
                    const rel = path.relative(SRC, archivo);
                    hits.push(`${rel}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(hits, `crudo reintroducido en ia/**:\n${hits.join("\n")}`).toEqual([]);
    });
});
