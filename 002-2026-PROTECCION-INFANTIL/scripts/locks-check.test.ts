/**
 * SPEC-284 (002-PI-184) — Tests unitarios de la compuerta locks:check.
 *
 * Cobertura:
 *   SC-005  BD sana (12 IDs únicos, tabla coincide) → ok=true
 *   SC-006  colisión con separadores JS (123_456_790 vs 123456790) → ok=false
 *   SC-007  desalineo tabla ↔ código en ambas direcciones → ok=false
 *   SC-009  duración < 500 ms
 *   Extra   archivo con múltiples declaraciones detectado
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verificarLocks } from "./locks-check";

let raiz: string;
let scriptsDir: string;
let tablaPath: string;

beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "locks-check-"));
    scriptsDir = join(raiz, "scripts");
    mkdirSync(scriptsDir);
    tablaPath = join(scriptsDir, "ADVISORY-LOCKS.md");
});

afterEach(() => {
    rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// Helper: escribe un worker mínimo con su ID
function escribirWorker(nombre: string, id: string): void {
    writeFileSync(
        join(scriptsDir, nombre),
        `import pg from "pg";\nconst { Client } = pg;\nconst ADVISORY_LOCK_ID = ${id};\nconsole.log(ADVISORY_LOCK_ID);\n`,
    );
}

// Helper: escribe la tabla markdown con los IDs dados
function escribirTabla(ids: string[]): void {
    const filas = ids
        .map((id, i) => `| \`${id}\` | scripts/worker-${i}.mjs | svc-${i} | fixture | test |`)
        .join("\n");
    writeFileSync(
        tablaPath,
        `# Fixture\n\n| ID | Worker | Servicio | Qué protege | SPEC |\n|---|---|---|---|---|\n${filas}\n`,
    );
}

describe("verificarLocks — caso feliz (SC-005)", () => {
    it("3 IDs únicos con tabla coincidente → ok=true", () => {
        escribirWorker("worker-a.mjs", "123456790");
        escribirWorker("worker-b.mjs", "123456791");
        escribirWorker("worker-c.mjs", "123456792");
        escribirTabla(["123456790", "123456791", "123456792"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(true);
        expect(res.total).toBe(3);
        expect(res.colisiones).toHaveLength(0);
        expect(res.soloEnCodigo).toHaveLength(0);
        expect(res.soloEnTabla).toHaveLength(0);
        expect(res.varias).toHaveLength(0);
    });
});

describe("verificarLocks — colisiones (SC-006)", () => {
    it("colisión literal exacta → ok=false y ambos archivos nombrados", () => {
        escribirWorker("worker-a.mjs", "123456790");
        escribirWorker("worker-b.mjs", "123456790");
        escribirTabla(["123456790"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.colisiones).toHaveLength(1);
        expect(res.colisiones[0].id).toBe("123456790");
        expect(res.colisiones[0].archivos).toEqual(["scripts/worker-a.mjs", "scripts/worker-b.mjs"]);
    });

    it("colisión con separadores JS (123_456_790 vs 123456790) → ok=false", () => {
        // Este es el caso que engañó al grep durante 3 semanas (D-004 §1).
        escribirWorker("worker-a.mjs", "123456790");
        escribirWorker("worker-b.mjs", "123_456_790");
        escribirTabla(["123456790"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.colisiones).toHaveLength(1);
        expect(res.colisiones[0].id).toBe("123456790");
        expect(res.colisiones[0].archivos).toEqual(["scripts/worker-a.mjs", "scripts/worker-b.mjs"]);
    });

    it("literal con `_` extraños (1_2__3) también se normaliza correctamente", () => {
        escribirWorker("worker-a.mjs", "1_2__3");
        escribirWorker("worker-b.mjs", "123");
        escribirTabla(["123"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.colisiones[0].id).toBe("123");
    });
});

describe("verificarLocks — desalineo tabla ↔ código (SC-007)", () => {
    it("ID en código faltante en tabla → ok=false", () => {
        escribirWorker("worker-a.mjs", "123456790");
        escribirWorker("worker-b.mjs", "123456791");
        escribirTabla(["123456790"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.soloEnCodigo).toEqual(["123456791"]);
        expect(res.soloEnTabla).toHaveLength(0);
    });

    it("ID en tabla que ningún .mjs declara → ok=false", () => {
        escribirWorker("worker-a.mjs", "123456790");
        escribirTabla(["123456790", "999999999"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.soloEnCodigo).toHaveLength(0);
        expect(res.soloEnTabla).toEqual(["999999999"]);
    });

    it("tabla con separadores JS también se normaliza al comparar con código", () => {
        escribirWorker("worker-a.mjs", "123456790");
        // Tabla escribe con `_`; comparación normaliza y debe cuadrar.
        escribirTabla(["123_456_790"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(true);
        expect(res.soloEnCodigo).toHaveLength(0);
        expect(res.soloEnTabla).toHaveLength(0);
    });
});

describe("verificarLocks — múltiples declaraciones en un archivo", () => {
    it("archivo con dos const ADVISORY_LOCK_ID → detectado como error", () => {
        writeFileSync(
            join(scriptsDir, "worker-duplo.mjs"),
            "const ADVISORY_LOCK_ID = 111;\nconst ADVISORY_LOCK_ID = 222;\n",
        );
        escribirTabla(["111", "222"]);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(false);
        expect(res.varias).toHaveLength(1);
        expect(res.varias[0].file).toBe("scripts/worker-duplo.mjs");
        expect(res.varias[0].declaraciones).toHaveLength(2);
    });
});

describe("verificarLocks — rendimiento (SC-009)", () => {
    it("verifica 20 archivos en < 500 ms", () => {
        for (let i = 0; i < 20; i++) escribirWorker(`worker-${i}.mjs`, `${100000 + i}`);
        const ids = Array.from({ length: 20 }, (_, i) => `${100000 + i}`);
        escribirTabla(ids);

        const res = verificarLocks({ scriptsDir, tablaPath });

        expect(res.ok).toBe(true);
        expect(res.total).toBe(20);
        expect(res.durationMs).toBeLessThan(500);
    });
});

describe("verificarLocks — metadatos", () => {
    it("devuelve durationMs no negativo y checkedAt ISO", () => {
        escribirWorker("worker-a.mjs", "1");
        escribirTabla(["1"]);
        const res = verificarLocks({ scriptsDir, tablaPath });
        expect(res.durationMs).toBeGreaterThanOrEqual(0);
        expect(res.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});
