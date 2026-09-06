/**
 * Candado (CEO 06-09) · `parseArgs` de scripts/demo ABORTA ante un flag desconocido.
 *
 * Los scripts de demo poblan y borran datos. Un flag que el parser traga en silencio (typo o
 * bandera no implementada) haría correr el modo por defecto creyendo que hizo lo pedido — la
 * misma trampa que `reset-piloto --purga-total` cuando el flag no existía. Este candado muere si
 * alguien vuelve `parseArgs` permisivo. Test PURO (sin BD) → lane unit.
 */
import { describe, it, expect } from "vitest";
import { parseArgs } from "./_common";

const FLAGS = ["motivo", "confirm", "semilla"];
const argv = (...flags: string[]) => ["node", "poblar-demo.ts", ...flags];

describe("scripts/demo · parseArgs estricto (no traga banderas)", () => {
    it("ABORTA ante un flag desconocido (typo o inventado), antes de tocar datos", () => {
        expect(() => parseArgs(argv("--confir"), FLAGS)).toThrow(/no reconocido/i);
        expect(() => parseArgs(argv("--flag-inventado=x"), FLAGS)).toThrow(/--flag-inventado/i);
    });

    it("acepta exactamente los flags declarados", () => {
        const args = parseArgs(argv("--confirm", "--motivo=x", "--semilla=5"), FLAGS);
        expect(args.confirm).toBe(true);
        expect(args.motivo).toBe("x");
        expect(args.semilla).toBe("5");
    });
});
