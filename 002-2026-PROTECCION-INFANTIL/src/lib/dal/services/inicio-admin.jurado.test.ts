import { describe, it, expect } from "vitest";
import { votantesDe } from "./inicio-admin";

/**
 * SPEC-398 (I-286) — helper puro que decodifica el formato de
 * `ClasificacionIA.modeloUsado` para contar votantes reales. El motor de la
 * rúbrica escribe `rubrica:m1+m2+m3` (o `rubrica:m1` cuando alguien pidió
 * override). Un test que solo mirase "hay un `+`" se engañaría con un solo
 * `+` extra por error; este cuenta piezas.
 */
describe("votantesDe (SPEC-398)", () => {
    it("comité de 3 modelos → 3 votantes", () => {
        expect(votantesDe("rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b")).toBe(3);
    });

    it("override mono-modelo → 1 votante (formato que dejó I-286 en las 52 clasificaciones vivas)", () => {
        expect(votantesDe("rubrica:gemma2:27b")).toBe(1);
    });

    it("comité de 2 modelos → 2 votantes", () => {
        expect(votantesDe("rubrica:gemma2:27b+ornith:9b")).toBe(2);
    });

    it("no es rúbrica (cache/guardas/cascada) → 0 (no aplica la señal)", () => {
        expect(votantesDe("cache:humano:abc-123")).toBe(0);
        expect(votantesDe("guardas-previas")).toBe(0);
        expect(votantesDe("cascada:demo")).toBe(0);
    });

    it("string vacío o `rubrica:` sin cuerpo → 0", () => {
        expect(votantesDe("")).toBe(0);
        expect(votantesDe("rubrica:")).toBe(0);
    });
});
