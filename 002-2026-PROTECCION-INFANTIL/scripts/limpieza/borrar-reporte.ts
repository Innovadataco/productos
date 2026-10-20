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
import { recalcularYGuardarScore } from "../../src/lib/scoring";
import { actualizarVisibilidadPublica } from "../../src/lib/visibility";
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
        eventosExpedienteDesvinculados: number;
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
        // SPEC-870 (I-446): identificador+plataformaId para recalcular el agregado PROPIO tras borrar.
        select: { id: true, numeroSeguimiento: true, identificador: true, plataformaId: true },
    });
    if (!reporte) {
        throw new Error(`[borrar-reporte] Reporte no encontrado: ${reporteId}`);
    }

    const eventosExpedienteCount = await client.eventoExpediente.count({ where: { reporteId } });

    const conteoDetalle = {
        solicitudesComite: await client.solicitudComite.count({ where: { reporteId } }),
        correcciones: await client.correccionAdmin.count({ where: { clasificacion: { reporteId } } }),
        eventosMatch: await client.eventoMatch.count({ where: { reporteNuevoId: reporteId } }),
        identificadoresHuerfanos: 0,
        reporte: 1,
        eventosExpedienteDesvinculados: eventosExpedienteCount,
    };

    if (!opts.confirm) {
        log("borrar-reporte", `DRY-RUN reporte=${reporteId} (${reporte.numeroSeguimiento ?? "sin-numero"})`);
        log("borrar-reporte", `  · SolicitudComite: ${conteoDetalle.solicitudesComite}`);
        log("borrar-reporte", `  · CorreccionAdmin: ${conteoDetalle.correcciones}`);
        log("borrar-reporte", `  · EventoMatch: ${conteoDetalle.eventosMatch}`);
        log("borrar-reporte", `  · EventoExpediente desvinculados (reporteId→null): ${conteoDetalle.eventosExpedienteDesvinculados}`);
        log("borrar-reporte", `  · Agregado propio ${reporte.identificador}@${reporte.plataformaId}: se RECALCULA tras borrar (0+oculto si era el último)`);
        log("borrar-reporte", "  · Reporte + cascade (ClasificacionIA, EmbeddingReporte, TransicionReporte, ReintentoReporte, AlertaColegio, SolicitudComite)");
        return { reporteId, filasBorradas: 0, detalle: conteoDetalle, dryRun: true };
    }

    return client.$transaction(async (tx) => {
        // SPEC-340: si el borrado es de un PRINCIPAL de cadena, sus eventos quedan
        // sueltos explícitamente (coherente con el onDelete: SetNull de la FK; acá
        // se hace visible y contable en el log de limpieza).
        const cadenaDesv = await tx.reporte.updateMany({
            where: { reportePrincipalId: reporteId },
            data: { reportePrincipalId: null },
        });
        if (cadenaDesv.count > 0) {
            log("borrar-reporte", `  · Eventos de cadena desvinculados (reportePrincipalId→null): ${cadenaDesv.count}`);
        }
        // Desvincular EventoExpediente ANTES de borrar el Reporte — reporteId es nullable
        // (RESTRICT sin onDelete); el evento debe sobrevivir vinculado al expediente.
        const evDesv = await tx.eventoExpediente.updateMany({
            where: { reporteId },
            data: { reporteId: null },
        });
        const sc = await tx.solicitudComite.deleteMany({ where: { reporteId } });
        const co = await tx.correccionAdmin.deleteMany({ where: { clasificacion: { reporteId } } });
        const em = await tx.eventoMatch.deleteMany({ where: { reporteNuevoId: reporteId } });
        const rep = await tx.reporte.delete({ where: { id: reporteId } });

        // SPEC-870 (I-446): recalcular el agregado público PROPIO del reporte borrado. Antes se
        // limpiaban SOLO los agregados ligados por `eventoMatch` — nunca el del identificador propio
        // (lo crea `upsertIncrementoReporte` al alta), así que un reporte SIN match dejaba su score
        // público colgado y visible. Reúso del MISMO escritor que el corrector (no divergen dos
        // caminos): con el reporte ya borrado, `calcularScore` cuenta los que QUEDAN vivos — 0 → score
        // 0 + `esVisiblePublicamente=false`; si quedan otros, computa el score restante (no los pisa a 0).
        await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId, tx);
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId, tx);
        const agregadoDespues = await tx.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: reporte.identificador, plataformaId: reporte.plataformaId } },
            select: { reportesAprobados: true },
        });
        // Informativo (NO suma a filasBorradas: es un recálculo, no un borrado): 1 si el agregado quedó
        // sin reportes aprobados tras el borrado (huérfano saneado a 0+oculto).
        const huerfanos = agregadoDespues && agregadoDespues.reportesAprobados === 0 ? 1 : 0;

        const detalle = {
            solicitudesComite: sc.count,
            correcciones: co.count,
            eventosMatch: em.count,
            identificadoresHuerfanos: huerfanos,
            reporte: rep ? 1 : 0,
            eventosExpedienteDesvinculados: evDesv.count,
        };
        // eventosExpedienteDesvinculados (updates) e identificadoresHuerfanos (recálculo, SPEC-870, NO
        // borra la fila) NO se suman a total: solo cuentan las filas realmente BORRADAS.
        const total = detalle.solicitudesComite + detalle.correcciones + detalle.eventosMatch + detalle.reporte;

        await registrarAuditoria(tx, "reporte", motivo, total, [reporteId]);
        log("borrar-reporte", `REALIZADO reporte=${reporteId} filas=${total}`);
        return { reporteId, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["id", "motivo", "confirm"]);
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
