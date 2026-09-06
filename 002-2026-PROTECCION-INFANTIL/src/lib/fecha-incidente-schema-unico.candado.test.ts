/**
 * SPEC-513 (PA-21) · Candado de CLASE: la cota de FUTURO de `fechaIncidente` vive
 * en UN solo validador — `fechaIncidenteSchema` en `src/lib/validators.ts`.
 * NINGUNA ruta de `src/app/api/**` puede declarar su PROPIO schema zod sobre
 * `fechaIncidente`: un `z.string().refine(Date.parse)` suelto en el evento
 * (`/api/reportes/[id]/evento`) derivó de la regla canónica y aceptaba fecha
 * futura (bug PA-21). El evento reusa ahora el validador compartido.
 *
 * Es candado de CLASE, no de caso: escanea TODO `app/api/**` (no solo el evento),
 * así cualquier ruta futura que copie la línea cae. Verificado por MUTACIÓN:
 * volver a poner `fechaIncidente: z.string()...` inline en cualquier route → rojo
 * con archivo:línea.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, ".."); // .../src
const API = path.join(SRC, "app", "api");
const VALIDATORS = path.join(SRC, "lib", "validators.ts");

function* rutas(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* rutas(p);
        else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) yield p;
    }
}

// Un schema zod PROPIO sobre el campo: `fechaIncidente : z.` — la forma buena es
// `fechaIncidente: fechaIncidenteSchema` (una referencia, no `z.`).
const INLINE = /fechaIncidente\s*:\s*z\./;

describe("SPEC-513 · fechaIncidente valida con UN solo validador compartido", () => {
    it("el validador compartido existe y lo exporta lib/validators (anti-falso-verde)", () => {
        expect(fs.existsSync(VALIDATORS)).toBe(true);
        expect(fs.readFileSync(VALIDATORS, "utf-8")).toMatch(/export const fechaIncidenteSchema\b/);
    });

    it("el evento reusa fechaIncidenteSchema (consumidor conocido)", () => {
        const evento = path.join(API, "reportes", "[id]", "evento", "route.ts");
        expect(fs.existsSync(evento), "no existe el route del evento").toBe(true);
        expect(fs.readFileSync(evento, "utf-8")).toMatch(/fechaIncidente\s*:\s*fechaIncidenteSchema/);
    });

    it("ninguna ruta de app/api/** declara su propio schema zod sobre fechaIncidente", () => {
        const total: string[] = [];
        const hits: string[] = [];
        for (const archivo of rutas(API)) {
            total.push(archivo);
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (INLINE.test(linea)) hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
            }
        }
        // Anti-falso-verde: el barrido resolvió realmente el árbol de rutas.
        expect(total.length).toBeGreaterThan(50);
        expect(
            hits,
            [
                "SPEC-513 — una ruta valida fechaIncidente con schema PROPIO:",
                ...hits,
                "",
                "La cota de futuro vive en `fechaIncidenteSchema` (src/lib/validators.ts).",
                "Usá `fechaIncidente: fechaIncidenteSchema`, no un `z.` inline.",
            ].join("\n"),
        ).toEqual([]);
    });
});
