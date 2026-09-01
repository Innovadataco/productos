/**
 * SPEC-265 (002-PI-168) — reset total de data de prueba del piloto.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/limpieza/reset-piloto.ts \
 *     --motivo="reset piloto agosto 2026" --confirm --backup=/tmp/backup.sql
 *
 * REQUIERE --confirm y --backup obligatorios. Sin cualquiera de los dos → error.
 *
 * Orquesta borrar-colegio + borrar-padre + borrar-reporte + borrar-simulacion.
 *
 * PRESERVA SIEMPRE:
 *  - usuario `soporte@innovadataco.com`
 *  - reportes RPT-1RR278, RPT-2JFULR, RPT-FA1C23 (D-001 §5 evidencia viva)
 *  - seed permanente (ParametroSistema, Plan, notificacion_*, geo, ModuloPermisible,
 *    GuiaAccionCategoria, FuenteReporte, DatasetEntrenamiento, EmbeddingDataset, AuditLog)
 */
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import {
    parseArgs,
    requerirMotivo,
    registrarAuditoria,
    log,
    PRESERVADOS,
} from "./_common";
import { borrarColegio } from "./borrar-colegio";
import { borrarPadre } from "./borrar-padre";
import { borrarReporte } from "./borrar-reporte";
import { borrarSimulacion } from "./borrar-simulacion";

interface ResumenReset {
    backupSize: number;
    colegios: string[];
    padres: string[];
    reportesHuerfanos: string[];
    simulaciones: string[];
}

function ejecutarBackup(rutaBackup: string): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[reset-piloto] DATABASE_URL no está definido");
    log("reset-piloto", `Ejecutando pg_dump → ${rutaBackup}`);
    execSync(`pg_dump "${url}" > "${rutaBackup}"`, { stdio: "inherit" });
    const size = statSync(rutaBackup).size;
    if (size < 1024) throw new Error(`[reset-piloto] Backup sospechosamente pequeño: ${size}B`);
    log("reset-piloto", `Backup OK — ${size} bytes`);
    return size;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const backup = typeof args.backup === "string" ? args.backup : "";
    if (!backup) throw new Error("[reset-piloto] Falta --backup=<ruta.sql>");
    if (args.confirm !== true) throw new Error("[reset-piloto] Falta --confirm");

    const backupSize = ejecutarBackup(backup);

    // A-66 (b): pre-borrado global del subárbol identificadores+alertas en orden
    // FK-safe ANTES del loop por colegio. Necesario porque AlertaColegio cruza
    // tenants (alertas.ts:94 buscarActivosPorValor): una alerta del colegio Y puede
    // referenciar un identificador del colegio X, por lo que borrar colegio X sin
    // haber eliminado esa alerta de Y causa FK. El pre-borrado global evita tener
    // que rastrear esa red cross-tenant desde borrar-colegio individualmente.
    log("reset-piloto", "Pre-borrado global: SolicitudComite, AlertaColegio, identificadores, observaciones...");
    await prisma.$transaction(async (tx) => {
        await tx.solicitudComite.deleteMany({});
        await tx.notaSeguimiento.deleteMany({});
        // SPEC-351: InformeCaso sin Cascade — explícito antes del caso.
        await tx.informeCaso.deleteMany({});
        await tx.seguimientoCaso.deleteMany({});
        await tx.alertaColegio.deleteMany({});
        await tx.identificadorProfesor.deleteMany({});
        await tx.identificadorEstudiante.deleteMany({});
        await tx.identificadorAcudiente.deleteMany({});
        await tx.estudianteObservacion.deleteMany({});
        await tx.acudienteEstudiante.deleteMany({});
    });
    log("reset-piloto", "Pre-borrado global completado.");

    const colegios = await prisma.colegio.findMany({ select: { id: true, nombre: true } });
    log("reset-piloto", `Colegios a borrar: ${colegios.length}`);
    for (const c of colegios) {
        await borrarColegio(c.id, motivo, { confirm: true, client: prisma });
    }

    const padres = await prisma.usuario.findMany({
        where: {
            rol: "PARENT",
            email: { notIn: [...PRESERVADOS.usuarios] },
        },
        select: { id: true, email: true },
    });
    log("reset-piloto", `Padres a borrar: ${padres.length}`);
    for (const p of padres) {
        await borrarPadre(p.email, motivo, { confirm: true, client: prisma });
    }

    const reportesHuerfanos = await prisma.reporte.findMany({
        where: {
            tenantId: null,
            usuarioId: null,
            numeroSeguimiento: { notIn: [...PRESERVADOS.reportesExcluidos] },
        },
        select: { id: true, numeroSeguimiento: true },
    });
    log("reset-piloto", `Reportes huérfanos a borrar: ${reportesHuerfanos.length}`);
    for (const r of reportesHuerfanos) {
        await borrarReporte(r.id, motivo, { confirm: true, client: prisma });
    }

    const simulaciones = await prisma.simulacionRun.findMany({ select: { id: true } });
    log("reset-piloto", `Simulaciones a borrar: ${simulaciones.length}`);
    for (const s of simulaciones) {
        await borrarSimulacion(s.id, motivo, { confirm: true, client: prisma });
    }

    const resumen: ResumenReset = {
        backupSize,
        colegios: colegios.map((c) => c.id),
        padres: padres.map((p) => p.email),
        reportesHuerfanos: reportesHuerfanos.map((r) => r.numeroSeguimiento ?? r.id),
        simulaciones: simulaciones.map((s) => s.id),
    };
    const totalIds =
        resumen.colegios.length +
        resumen.padres.length +
        resumen.reportesHuerfanos.length +
        resumen.simulaciones.length;

    await prisma.$transaction(async (tx) => {
        await registrarAuditoria(
            tx,
            "reset_piloto",
            motivo,
            totalIds,
            [
                ...resumen.colegios,
                ...resumen.padres,
                ...resumen.reportesHuerfanos,
                ...resumen.simulaciones,
            ],
        );
    });

    log("reset-piloto", `REALIZADO backup=${backupSize}B colegios=${resumen.colegios.length} padres=${resumen.padres.length} reportes=${resumen.reportesHuerfanos.length} simulaciones=${resumen.simulaciones.length}`);
}

if (process.argv[1]?.endsWith("reset-piloto.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reset-piloto] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
