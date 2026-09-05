/**
 * SPEC-494 · el mueble Skeleton reemplazó el spinner de PÁGINA (§4.8).
 *
 * Conducta, muere con el defecto (regla de la casa):
 *  - 0 spinner de carga de PÁGINA en `src/app/dashboard/**`. El idioma del spinner
 *    de página es el ring manual `animate-spin rounded-full border-2 … border-t-…`
 *    (un `<span>`/`<div>` centrado en `{loading ? …}`). Reintroducir uno → rojo.
 *  - **Contraprueba (no debe disparar):** el spinner-EN-BOTÓN se conserva — se
 *    expresa con `<Button isLoading>` (prop, sin ring inline) y NO matchea este
 *    patrón; el candado NO se pone rojo por él. Se verifica que ese patrón siga
 *    presente (no se barrieron los botones por error).
 *  - El mueble está en uso: hay al menos un `SkeletonX` en el dashboard.
 *
 * El ring vive en `Button.tsx` (mueble), fuera de este escaneo (solo páginas).
 * Los micro-indicadores `<Loader2 className="animate-spin">` (op en curso inline)
 * no usan `rounded-full border-2` → no son spinner de página, no se vigilan aquí.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD = __dirname;

function* recorrer(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) yield ruta;
    }
}

const SPINNER_PAGINA = /animate-spin[^"'`]*rounded-full[^"'`]*border-2/;

describe("SPEC-494 · skeleton de carga, no spinner de página", () => {
    const archivos = [...recorrer(DASHBOARD)];

    it("0 spinner de PÁGINA (ring manual) en src/app/dashboard/**", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (SPINNER_PAGINA.test(linea)) hits.push(`${path.relative(DASHBOARD, archivo)}:${i + 1}`);
            }
        }
        expect(hits, `spinner de página reintroducido:\n${hits.join("\n")}`).toEqual([]);
    });

    it("el mueble Skeleton está en uso (reemplazó los spinners)", () => {
        const usa = archivos.some((a) => /\bSkeleton[A-Z]/.test(fs.readFileSync(a, "utf-8")));
        expect(usa, "no se encontró ningún SkeletonX en el dashboard").toBe(true);
    });

    it("contraprueba · el spinner-EN-BOTÓN (Button isLoading) se conserva", () => {
        const conserva = archivos.some((a) => /isLoading=/.test(fs.readFileSync(a, "utf-8")));
        expect(conserva, "se barrieron los spinners de botón por error").toBe(true);
    });
});
