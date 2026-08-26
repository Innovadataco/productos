/**
 * SPEC-265 (002-PI-168) — borra UN reporte y sus derivados.
 *
 * Uso (dry-run, imprime conteos sin borrar):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-reporte.ts \
 *     --id=<reporteId> --motivo="limpieza tras prueba X"
 *
 * Uso (borrado real, transaccional):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-reporte.ts \
 *     --id=<reporteId> --motivo="limpieza tras prueba X" --confirm
 *
 * Orden FK-safe:
 *   SolicitudComite → CorreccionAdmin → EventoMatch → NotaSeguimiento →
 *   SeguimientoCaso → IdentificadorReportado (si huérfano) → Reporte
 *   (cascade: ClasificacionIA, EmbeddingReporte, TransicionReporte,
 *    ReintentoReporte, AlertaColegio, SolicitudComite, SimulacionReporte)
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs, requerirMotivo, registrarAuditoria, log } from "./_common";

export interface ResultadoBorrarReporte {
    reporteId: string;
    filasBorradas: number;
    detalle: {
        solicitudesComite: number;
        correcciones: number;
        eventosMatch: number;
        identificadoresHuerfanos: number;
        reporte: number;
    };
    dryRun: boolean;
}

export async function borrarReporte(
    reporteId: string,
    motivo: string,
    opts: { confirm: boolean; client?: PrismaClient } = { confirm: false },
): Promise<ResultadoBorrarReporte> {
    const client = opts.client ?? prisma;

    const reporte = await client.reporte.findUnique({
        where: { id: reporteId },
        select: { id: true, numeroSeguimiento: true },
    });
    if (!reporte) {
        throw new Error(`[borrar-reporte] Reporte no encontrado: ${reporteId}`);
    }

    const identificadores = await client.identificadorReportado.findMany({
        where: { eventosMatch: { some: { reporteNuevoId: reporteId } } },
        select: { id: true, identificador: true, plataformaId: true },
    });

    const conteoDetalle = {
        solicitudesComite: await client.solicitudComite.count({ where: { reporteId } }),
        correcciones: await client.correccionAdmin.count({ where: { clasificacion: { reporteId } } }),
        eventosMatch: await client.eventoMatch.count({ where: { reporteNuevoId: reporteId } }),
        identificadoresHuerfanos: 0,
        reporte: 1,
    };

    if (!opts.confirm) {
        log("borrar-reporte", `DRY-RUN reporte=${reporteId} (${reporte.numeroSeguimiento ?? "sin-numero"})`);
        log("borrar-reporte", `  · SolicitudComite: ${conteoDetalle.solicitudesComite}`);
        log("borrar-reporte", `  · CorreccionAdmin: ${conteoDetalle.correcciones}`);
        log("borrar-reporte", `  · EventoMatch: ${conteoDetalle.eventosMatch}`);
        log("borrar-reporte", `  · Identificadores candidatos a huérfano: ${identificadores.length}`);
        log("borrar-reporte", "  · Reporte + cascade (ClasificacionIA, EmbeddingReporte, TransicionReporte, ReintentoReporte, AlertaColegio, SolicitudComite)");
        return { reporteId, filasBorradas: 0, detalle: conteoDetalle, dryRun: true };
    }

    return client.$transaction(async (tx) => {
        const sc = await tx.solicitudComite.deleteMany({ where: { reporteId } });
        const co = await tx.correccionAdmin.deleteMany({ where: { clasificacion: { reporteId } } });
        const em = await tx.eventoMatch.deleteMany({ where: { reporteNuevoId: reporteId } });
        const rep = await tx.reporte.delete({ where: { id: reporteId } });

        let huerfanos = 0;
        for (const ident of identificadores) {
            const otros = await tx.eventoMatch.count({ where: { identificadorId: ident.id } });
            if (otros === 0) {
                await tx.identificadorReportado.delete({ where: { id: ident.id } });
                huerfanos += 1;
            }
        }

        const detalle = {
            solicitudesComite: sc.count,
            correcciones: co.count,
            eventosMatch: em.count,
            identificadoresHuerfanos: huerfanos,
            reporte: rep ? 1 : 0,
        };
        const total = Object.values(detalle).reduce((a, b) => a + b, 0);

        await registrarAuditoria(tx, "reporte", motivo, total, [reporteId]);
        log("borrar-reporte", `REALIZADO reporte=${reporteId} filas=${total}`);
        return { reporteId, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const id = typeof args.id === "string" ? args.id : "";
    if (!id) throw new Error("[borrar-reporte] Falta --id=<reporteId>");
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await borrarReporte(id, motivo, { confirm });
}

if (process.argv[1]?.endsWith("borrar-reporte.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-reporte] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
