/**
 * SPEC-248 (002-PI-151) · idempotencia del bloque `ia.rubrica.definiciones` +
 * `scoring.severity.*` de las 3 categorías nuevas. Mismo patrón que
 * seed-idempotencia.test.ts (SPEC-187): correr `main()` dos veces.
 */
import { describe, it, expect } from "vitest";
import { main } from "../../prisma/seed";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { DEFINICIONES_CATEGORIA } from "@/lib/ai/rubrica-semilla";

describe("seed idempotencia — definiciones legales y severidades Ley 2564 (SPEC-248)", { timeout: 60_000 }, () => {
    it("primera corrida siembra las 14 definiciones y las 3 severidades nuevas", async () => {
        await resetDatabase();
        await main();

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.definiciones" } });
        expect(JSON.parse(param!.valor)).toEqual(DEFINICIONES_CATEGORIA);

        const severidades = await prisma.parametroSistema.findMany({
            where: { clave: { in: ["scoring.severity.CIBERACOSO", "scoring.severity.HAPPY_SLAPPING", "scoring.severity.STALKING"] } },
        });
        const porClave = Object.fromEntries(severidades.map((s) => [s.clave, s.valor]));
        expect(porClave["scoring.severity.CIBERACOSO"]).toBe("60");
        expect(porClave["scoring.severity.HAPPY_SLAPPING"]).toBe("75");
        expect(porClave["scoring.severity.STALKING"]).toBe("70");
    });

    it("re-seed NO pisa una definición editada por ADMIN/comité (idempotente-respetuoso)", async () => {
        await resetDatabase();
        await main();

        await prisma.parametroSistema.update({
            where: { clave: "ia.rubrica.definiciones" },
            data: {
                valor: JSON.stringify({
                    ...DEFINICIONES_CATEGORIA,
                    CIBERACOSO: { ...DEFINICIONES_CATEGORIA.CIBERACOSO, definicionLiteral: "Editado a mano por el comité." },
                }),
            },
        });

        await main();

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.definiciones" } });
        const definiciones = JSON.parse(param!.valor);
        expect(definiciones.CIBERACOSO.definicionLiteral).toBe("Editado a mano por el comité.");
    });

    it("re-seed NO pisa una severidad editada manualmente (idempotente-respetuoso)", async () => {
        await resetDatabase();
        await main();

        await prisma.parametroSistema.update({
            where: { clave: "scoring.severity.STALKING" },
            data: { valor: "85" },
        });

        await main();

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "scoring.severity.STALKING" } });
        expect(param?.valor).toBe("85");
    });
});
