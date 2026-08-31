/**
 * SPEC-247 (002-PI-150): el seed de reglas de notificación debe ser idempotente.
 * SPEC-333 (002-PI-233 · I-223): la identidad de la regla ahora incluye `rol`
 * (@@unique([evento, canal, plantillaClave, rol])). Un "duplicado" es una fila
 * repetida por esa clave de 4 columnas; dos roles del mismo (evento, canal,
 * plantillaClave) NO son duplicados — son el des-colapso multi-rol correcto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedEventosSuscripcion, seedEventosRecompensa } from "../../../prisma/seed";

async function contarDuplicados(): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM (
            SELECT evento, canal, "plantillaClave", rol
            FROM "notificacion_reglas"
            GROUP BY evento, canal, "plantillaClave", rol
            HAVING COUNT(*) > 1
        ) d
    `;
    return Number(rows[0]?.count ?? 0);
}

describe("seed NotificacionRegla — dedup (SPEC-247)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("seedEventosSuscripcion ejecutado dos veces deja 0 duplicados", async () => {
        await seedEventosSuscripcion();
        await seedEventosSuscripcion();
        expect(await contarDuplicados()).toBe(0);
    });

    it("seedEventosRecompensa ejecutado dos veces deja 0 duplicados", async () => {
        await seedEventosRecompensa();
        await seedEventosRecompensa();
        expect(await contarDuplicados()).toBe(0);
    });
});
