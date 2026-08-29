/**
 * SPEC-280: pruebas unitarias del constructor de resumen del CI.
 * Corren con vitest en el config unit (no requieren BD).
 */
import { describe, it, expect } from "vitest";
import { construirResumen } from "./resumen.mjs";

function job(name, conclusion, dur) {
    const start = new Date("2026-08-26T10:00:00Z").getTime();
    return {
        name,
        conclusion,
        started_at: new Date(start).toISOString(),
        completed_at: new Date(start + dur * 1000).toISOString(),
    };
}

describe("construirResumen (SPEC-280)", () => {
    it("run verde con todos los inspectores → cabecera ✅ y tabla completa", () => {
        const jobs = [
            job("verificaciones", "success", 112),
            job("test-unit", "success", 45),
            job("test-integration (1)", "success", 252),
            job("test-integration (2)", "success", 248),
            job("test-integration (3)", "success", 255),
            job("test-integration (4)", "success", 245),
            job("journeys", "success", 141),
            job("build", "success", 127),
        ];
        const vitest = { numTotalTests: 1512, testResults: [] };
        const coverage = { total: { lines: { pct: 38.1 } } };
        const md = construirResumen({ jobs, vitest, coverage, pisoLineas: 36 });
        expect(md).toContain("✅ CI verde");
        expect(md).toContain("1512 pruebas");
        expect(md).toContain("cobertura 38.1 %");
        expect(md).toContain("| verificaciones | ✅ |");
        expect(md).toContain("| build | ✅ |");
        expect(md).not.toContain("Falló");
    });

    it("run con test-integration (3) rojo → cabecera ❌ y nombre del primer fallo", () => {
        const jobs = [
            job("verificaciones", "success", 100),
            job("test-integration (3)", "failure", 900),
        ];
        const vitest = {
            numTotalTests: 1512,
            testResults: [
                {
                    name: "src/foo/bar.test.ts",
                    assertionResults: [
                        { status: "passed", title: "primero", ancestorTitles: ["Bar"] },
                        { status: "failed", title: "segundo se cae", ancestorTitles: ["Bar"] },
                    ],
                },
            ],
        };
        const md = construirResumen({ jobs, vitest, coverage: null, pisoLineas: 36 });
        expect(md).toContain("❌ CI rojo");
        expect(md).toContain("cobertura n/d");
        expect(md).toContain("| test-integration (3) | ❌ |");
        expect(md).toMatch(/Falló:.*src\/foo\/bar\.test\.ts.*Bar > segundo se cae/);
    });

    it("shard cancelado → fila ⏸️ y cabecera ⏸️ si no hay ❌", () => {
        const jobs = [
            job("verificaciones", "success", 100),
            job("test-integration (2)", "cancelled", 60),
        ];
        const md = construirResumen({ jobs, vitest: { numTotalTests: 0, testResults: [] }, coverage: null, pisoLineas: 36 });
        expect(md).toContain("⏸️ CI cancelado");
        expect(md).toContain("| test-integration (2) | ⏸️ |");
    });

    it("skipped se omite de la tabla", () => {
        const jobs = [
            job("verificaciones", "success", 100),
            job("test-unit", "skipped", 0),
        ];
        const md = construirResumen({ jobs, vitest: null, coverage: null, pisoLineas: 36 });
        expect(md).toContain("| verificaciones |");
        expect(md).not.toContain("| test-unit |");
    });

    it("sin vitest ni coverage → resumen parcial con warning", () => {
        const jobs = [job("verificaciones", "success", 100)];
        const md = construirResumen({ jobs, vitest: null, coverage: null, pisoLineas: 36 });
        expect(md).toContain("cobertura n/d");
        expect(md).toContain("resumen parcial");
    });
});
