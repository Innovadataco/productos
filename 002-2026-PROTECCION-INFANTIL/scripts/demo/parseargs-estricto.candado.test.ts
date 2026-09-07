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
import { validarFlagsResetPiloto } from "../limpieza/_common";

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

// SPEC-578 · candado de flags de reset-piloto: --confirm obligatorio en todos
// los modos (incluido --purga-total) y --backup / --backup-ya-tomado mutuamente
// excluyentes. Función pura → lane unit.
describe("scripts/limpieza · validarFlagsResetPiloto (SPEC-578)", () => {
    const args = (...flags: string[]) => {
        const parsed: Record<string, string | boolean> = {};
        for (const raw of flags) {
            const [k, v] = raw.replace(/^--/, "").split("=");
            parsed[k] = v === undefined ? true : v;
        }
        return parsed;
    };

    it("--purga-total sin --confirm → error antes de tocar nada", () => {
        expect(() => validarFlagsResetPiloto(args("--backup=/tmp/b.sql", "--purga-total"))).toThrow(/Falta --confirm/);
    });

    it("--solo-sembrado sin --confirm → error (también exige confirm)", () => {
        expect(() => validarFlagsResetPiloto(args("--backup=/tmp/b.sql", "--solo-sembrado"))).toThrow(/Falta --confirm/);
    });

    it("--backup y --backup-ya-tomado juntos → error (mutuamente excluyentes)", () => {
        expect(() =>
            validarFlagsResetPiloto(args("--confirm", "--backup=/tmp/a.sql", "--backup-ya-tomado=/tmp/b.sql")),
        ).toThrow(/mutuamente excluyentes/);
    });

    it("sin --backup ni --backup-ya-tomado → error", () => {
        expect(() => validarFlagsResetPiloto(args("--confirm", "--purga-total"))).toThrow(/--backup/);
    });

    it("--backup-ya-tomado válido: no genera backup, solo normaliza la ruta", () => {
        const flags = validarFlagsResetPiloto(args("--confirm", "--backup-ya-tomado=/tmp/b.sql", "--purga-total"));
        expect(flags.backupYaTomado).toBe("/tmp/b.sql");
        expect(flags.backup).toBe("");
        expect(flags.purgaTotal).toBe(true);
    });

    it("modo default con --backup sigue siendo válido", () => {
        const flags = validarFlagsResetPiloto(args("--confirm", "--backup=/tmp/b.sql"));
        expect(flags.backup).toBe("/tmp/b.sql");
        expect(flags.purgaTotal).toBe(false);
        expect(flags.soloSembrado).toBe(false);
    });
});
