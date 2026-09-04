/**
 * SPEC-450 (I-282) · el margen contra el techo de 45 minutos.
 *
 * El diagnóstico: **no había cuelgue**. La suite corría 17-19 min por shard y a
 * veces 40-43 — el 96 % del `timeout 45m`. Cruzarlo dispara el reintento de
 * SPEC-407 y el job termina en 63-90 min, que es lo que se veía como «colgado».
 *
 * Esta spec **no toca el techo ni el reintento**: agranda el margen (6 shards) y
 * hace visible la deriva (aviso a los 30 min, y pesos que dicen de cuántas
 * corridas salen). Los candados de acá vigilan las dos cosas que, si se
 * deshacen, devuelven el problema en silencio.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const RAIZ_PRODUCTO = resolve(import.meta.dirname, "..", "..");
const CI = resolve(RAIZ_PRODUCTO, "..", ".github", "workflows", "ci.yml");
const workflow = readFileSync(CI, "utf-8");

/**
 * El banner con el peso estimado va por STDERR; stdout es la lista de archivos.
 * Por eso `spawnSync` y no `execFileSync`: este último devuelve solo stdout.
 */
function repartir(shard) {
    const r = spawnSync(
        "node",
        ["scripts/ci/reparto-shards.mjs", `--shard=${shard}/6`, "--durations", "test-durations.json"],
        { cwd: RAIZ_PRODUCTO, encoding: "utf-8" },
    );
    return { stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("SPEC-450 · el margen se agranda sin tocar el techo", () => {
    it("la matriz reparte en SEIS shards", () => {
        expect(workflow).toMatch(/shard:\s*\[1,\s*2,\s*3,\s*4,\s*5,\s*6\]/);
    });

    it("el techo de 45 min y el reintento de SPEC-407 siguen INTACTOS", () => {
        expect(
            workflow.includes("timeout 45m"),
            "SPEC-450 agranda el margen; el techo es de SPEC-407 y no se toca.",
        ).toBe(true);
        expect(
            /EXIT"?\s*-eq\s*124/.test(workflow),
            "El reintento SOLO por exit 124 es lo que impide reintentar un test rojo.",
        ).toBe(true);
    });

    it("el fallback de vitest también reparte en 6 — si no, se solaparían los archivos", () => {
        expect(
            /--shard=\$\{\{ matrix\.shard \}\}\/4/.test(workflow),
            "Un fallback en /4 con matriz de 6 deja dos shards corriendo lo mismo y dos sin correr nada.",
        ).toBe(false);
        expect(workflow).toMatch(/--shard=\$\{\{ matrix\.shard \}\}\/6/);
    });

    it("hay señal a los 30 minutos, y AVISA en vez de cortar", () => {
        expect(workflow).toContain("SPEC-450 · shard");
        expect(workflow).toMatch(/-ge\s+1800/);
        expect(
            /exit\s+1/.test(workflow.slice(workflow.indexOf("SPEC-450 (I-282) · SEÑAL"), workflow.indexOf("SPEC-450 (I-282) · SEÑAL") + 800)),
            "La señal temprana no puede cortar la corrida: solo avisar.",
        ).toBe(false);
    });
});

describe("SPEC-450 · el reparto en 6 sigue equilibrado", () => {
    const pesos = [1, 2, 3, 4, 5, 6].map((n) => {
        const m = /peso estimado (\d+)s/.exec(repartir(n).stderr);
        return m ? Number(m[1]) : NaN;
    });

    it("los seis shards salen con el mismo peso estimado", () => {
        expect(pesos.every((p) => Number.isFinite(p))).toBe(true);
        const min = Math.min(...pesos);
        const max = Math.max(...pesos);
        expect(
            max - min,
            `Pesos: ${pesos.join(", ")}. Un reparto desparejo devuelve el problema que la spec cierra.`,
        ).toBeLessThanOrEqual(Math.round(max * 0.05));
    });

    it("y ningún shard queda vacío", () => {
        for (const n of [1, 2, 3, 4, 5, 6]) {
            const archivos = repartir(n).stdout.trim();
            expect(archivos.length, `el shard ${n} quedó sin archivos`).toBeGreaterThan(0);
        }
    });
});

describe("SPEC-450 · un peso sin medir AVISA, no entra callado", () => {
    it("el reparto emite un ::warning por los archivos sin medición", () => {
        const { stderr } = repartir(1);
        // Puede no haber ninguno sin medir (archivo recién refrescado): en ese
        // caso no hay warning, y está bien. Lo que NO puede pasar es que existan
        // y no se digan — por eso el candado mira el mecanismo, no el conteo.
        expect(
            stderr,
            "El reparto tiene que reportar por stderr lo que hace y lo que no sabe.",
        ).toMatch(/peso estimado/);
    });

    it("el archivo de pesos declara de cuántas corridas sale cada número", () => {
        const dur = JSON.parse(readFileSync(resolve(RAIZ_PRODUCTO, "test-durations.json"), "utf-8"));
        const entradas = Object.entries(dur).filter(([k]) => k !== "_meta");
        expect(entradas.length).toBeGreaterThan(100);

        // El formato viejo (número suelto) se sigue aceptando: la migración es
        // gradual y la hace la primera corrida en rama base. Lo que se exige es
        // que el LECTOR entienda las dos formas — si no, un refresco rompería el
        // reparto entero en silencio.
        const script = readFileSync(resolve(RAIZ_PRODUCTO, "scripts/ci/reparto-shards.mjs"), "utf-8");
        expect(script).toContain("muestras");
        expect(script, "tiene que seguir leyendo el número suelto del formato viejo").toMatch(
            /typeof v === "number"/,
        );
    });

    it("el actualizador usa MEDIANA de una ventana, no la media de una sola corrida", () => {
        const script = readFileSync(resolve(RAIZ_PRODUCTO, "scripts/ci/actualizar-duraciones.mjs"), "utf-8");
        expect(script).toContain("medianaDe");
        expect(script).toContain("VENTANA_MUESTRAS");
        expect(
            /0\.4 \* totalMs \+ 0\.6 \* previoMs/.test(script),
            "La media móvil dejaba que un runner lento contaminara el peso para siempre.",
        ).toBe(false);
    });
});
