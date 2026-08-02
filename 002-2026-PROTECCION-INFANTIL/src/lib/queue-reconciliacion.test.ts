/**
 * SPEC-137 (E-5, FR-003): reconciliación del encolado.
 * - Un PENDIENTE viejo sin job se encola (job real en pgboss.job).
 * - Segunda corrida: no-op (filtro anti-reencolado).
 * - POSIBLE_SPAM y REVISION_MANUAL sin job: intactos (no se tocan).
 * - PENDIENTE reciente (< 1 min): saltado por la ventana de gracia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { reencolarPendientesSinJob } from "./queue";
import type { EstadoReporte } from "@prisma/client";

async function sembrarReporte(estado: EstadoReporte, creadoEn: Date, tag: string) {
    const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
    return prisma.reporte.create({
        data: {
            identificador: `+57300REC${tag}`,
            plataformaId: plataforma.id,
            texto: `Texto del caso de reconciliación ${tag} con suficiente longitud.`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-REC-${tag}`,
            estado,
            creadoEn,
        },
    });
}

async function jobActivoDe(reporteId: string) {
    const jobs = (await prisma.$queryRaw`
        SELECT id FROM pgboss.job
        WHERE name = 'reporte-procesamiento'
          AND data->>'reporteId' = ${reporteId}
          AND state IN ('created', 'retry', 'active')
    `) as { id: string }[];
    return jobs[0] ?? null;
}

describe("SPEC-137 · reencolarPendientesSinJob", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        // La cola pg-boss persiste entre tests (resetDatabase no la limpia).
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("encola un PENDIENTE viejo sin job, es idempotente, no toca spam/revisión y respeta la gracia", async () => {
        const viejo = new Date(Date.now() - 5 * 60_000);
        const reciente = new Date(Date.now() - 10_000); // < 1 min: dentro de la gracia

        const huerfano = await sembrarReporte("PENDIENTE", viejo, "H1");
        const recienteReporte = await sembrarReporte("PENDIENTE", reciente, "R1");
        const spam = await sembrarReporte("POSIBLE_SPAM", viejo, "S1");
        const revision = await sembrarReporte("REVISION_MANUAL", viejo, "M1");

        // Primera corrida: el huérfano se encola; el resto queda fuera.
        const primera = await reencolarPendientesSinJob();
        expect(primera.encontrados).toBe(1);
        expect(primera.encolados).toBe(1);
        expect(primera.saltados).toBe(0);
        expect(await jobActivoDe(huerfano.id), "el huérfano queda con job real en pgboss.job").not.toBeNull();

        // Segunda corrida: no-op (el filtro anti-reencolado lo excluye).
        const segunda = await reencolarPendientesSinJob();
        expect(segunda.encontrados).toBe(0);
        expect(segunda.encolados).toBe(0);

        // El reciente (< 1 min) fue saltado por la gracia: sin job.
        expect(await jobActivoDe(recienteReporte.id), "el reciente no se encola (gracia de 1 min)").toBeNull();

        // Spam y revisión manual: intactos (sin job, mismo estado).
        expect(await jobActivoDe(spam.id)).toBeNull();
        expect(await jobActivoDe(revision.id)).toBeNull();
        expect((await prisma.reporte.findUnique({ where: { id: spam.id } }))!.estado).toBe("POSIBLE_SPAM");
        expect((await prisma.reporte.findUnique({ where: { id: revision.id } }))!.estado).toBe("REVISION_MANUAL");
    });
});
