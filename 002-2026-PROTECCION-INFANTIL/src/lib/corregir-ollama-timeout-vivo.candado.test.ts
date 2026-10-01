/**
 * SPEC-812 (pieza 3) · CANDADO de integración del corrector del valor VIVO de ia.ollama.timeout_ms.
 *
 *   - 120000 → --confirm lo baja a 60000 POR EL SERVICIO: AuditLog con actor NULL + motivo presente.
 *   - DRY-RUN deja la BD IDÉNTICA (no escribe, no audita).
 *   - Idempotente + control positivo: un parámetro ya en 60000 NO se toca.
 *   - Si el parámetro NO existe, el corrector NO lo crea (sembrarlo es del seed, no del corrector vivo).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { corregirTimeoutOllamaVivo } from "../../scripts/corregir-ollama-timeout-vivo";

const CLAVE = "ia.ollama.timeout_ms";

async function sembrarTimeout(valor: string): Promise<void> {
    await prisma.parametroSistema.create({
        data: { clave: CLAVE, valor, tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
    });
}

describe("corrector del valor vivo de ia.ollama.timeout_ms (SPEC-812 pieza 3)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("--confirm baja 120000 → 60000 por el servicio (AuditLog: actor null + motivo)", async () => {
        await sembrarTimeout("120000");
        const r = await corregirTimeoutOllamaVivo(prisma, { dryRun: false });
        expect(r.valorActual).toBe("120000");
        expect(r.escrito).toBe(true);

        const fila = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } });
        expect(fila?.valor).toBe("60000");
        expect(fila?.actualizadoPorId).toBeNull();

        const audits = await prisma.auditLog.findMany({ where: { parametroId: fila!.id } });
        expect(audits).toHaveLength(1);
        expect(audits[0].usuarioId).toBeNull();
        const meta = audits[0].metadatos as unknown as { motivo?: string; corrector?: boolean } | null;
        expect(meta?.motivo).toBeTruthy();
        expect(meta?.corrector).toBe(true);
    });

    it("DRY-RUN deja la BD idéntica (no escribe, no audita)", async () => {
        await sembrarTimeout("120000");
        const r = await corregirTimeoutOllamaVivo(prisma, { dryRun: true });
        expect(r.escrito).toBe(false);

        const fila = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } });
        expect(fila?.valor).toBe("120000");
        expect(await prisma.auditLog.count()).toBe(0);
    });

    it("idempotente + control positivo: ya en 60000 no se toca", async () => {
        await sembrarTimeout("60000");
        const r = await corregirTimeoutOllamaVivo(prisma, { dryRun: false });
        expect(r.yaEnObjetivo).toBe(true);
        expect(r.escrito).toBe(false);
        expect(await prisma.auditLog.count()).toBe(0);
    });

    it("si el parámetro no existe, NO lo crea (sembrarlo es del seed)", async () => {
        const r = await corregirTimeoutOllamaVivo(prisma, { dryRun: false });
        expect(r.valorActual).toBeNull();
        expect(r.escrito).toBe(false);
        expect(await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } })).toBeNull();
    });
});
