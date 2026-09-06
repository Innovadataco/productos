#!/usr/bin/env tsx
/**
 * Purga quirúrgica de datos demo. Borra EXCLUSIVAMENTE por DemoMarcado.
 *
 * Estrategia:
 *  1. Entidades derivadas de reporte se borran por su vínculo reporteId
 *     (el motor las crea y no todas quedan en DemoMarcado).
 *  2. Entidades derivadas de estudiante se borran por estudianteId.
 *  3. Entidades marcadas directamente se borran por DemoMarcado.entidadId.
 *  4. Finalmente se limpia DemoMarcado.
 *
 * Uso:
 *   node --env-file=.env.test --import tsx scripts/demo-prod/purgar-demo.ts [--dry-run]
 */
import { prisma } from "./lib/prisma";
import { ORDEN_BORRADO } from "./lib/orden-borrado";

const DRY_RUN = process.argv.includes("--dry-run");

async function contarDemo(): Promise<number> {
    return prisma.demoMarcado.count();
}

async function entidadDemoIds(entidad: string): Promise<string[]> {
    const rows = await prisma.demoMarcado.findMany({
        where: { entidad },
        select: { entidadId: true },
    });
    return rows.map((r) => r.entidadId);
}

async function main() {
    const totalAntes = await contarDemo();
    console.log(`[purgar-demo] Registros DemoMarcado antes: ${totalAntes}`);
    if (totalAntes === 0) {
        console.log("[purgar-demo] Nada que purgar.");
        await prisma.$disconnect();
        return;
    }

    if (DRY_RUN) {
        const porEntidad = await prisma.demoMarcado.groupBy({ by: ["entidad"], _count: { entidad: true } });
        console.log("[purgar-demo] DRY-RUN — entidades a borrar:");
        for (const row of porEntidad) {
            console.log(`  ${row.entidad}: ${row._count.entidad}`);
        }
        await prisma.$disconnect();
        return;
    }

    const reporteIds = await entidadDemoIds("Reporte");
    const estudianteIds = await entidadDemoIds("Estudiante");
    const colegioIds = await entidadDemoIds("Colegio");
    // SPEC-516: expedientes demo (padre-derivados; su cadena no la cubre el reporte).
    const expedienteIds = await entidadDemoIds("Expediente");

    console.log(
        `[purgar-demo] Reportes demo: ${reporteIds.length}, Estudiantes demo: ${estudianteIds.length}, Colegios demo: ${colegioIds.length}`,
    );

    // ------------------------------------------------------------------
    // Fase 1: derivadas de reporte (orden de más dependientes a menos)
    // ------------------------------------------------------------------
    if (reporteIds.length > 0) {
        // NotaSeguimiento -> SeguimientoCaso -> AlertaColegio -> Reporte
        const alertas = await prisma.alertaColegio.findMany({
            where: { reporteId: { in: reporteIds } },
            select: { id: true },
        });
        const alertaIds = alertas.map((a) => a.id);
        if (alertaIds.length > 0) {
            const seguimientos = await prisma.seguimientoCaso.findMany({
                where: { alertaId: { in: alertaIds } },
                select: { id: true },
            });
            const seguimientoIds = seguimientos.map((s) => s.id);
            if (seguimientoIds.length > 0) {
                const notas = await prisma.notaSeguimiento.deleteMany({
                    where: { seguimientoId: { in: seguimientoIds } },
                });
                console.log(`[purgar-demo] Borradas ${notas.count} NotaSeguimiento`);
                const segDel = await prisma.seguimientoCaso.deleteMany({
                    where: { id: { in: seguimientoIds } },
                });
                console.log(`[purgar-demo] Borrados ${segDel.count} SeguimientoCaso`);
            }
        }

        const alertasDel = await prisma.alertaColegio.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${alertasDel.count} AlertaColegio`);

        const solicitudesDel = await prisma.solicitudComite.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${solicitudesDel.count} SolicitudComite`);

        const clasificacionesDel = await prisma.clasificacionIA.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${clasificacionesDel.count} ClasificacionIA`);

        const transicionesDel = await prisma.transicionReporte.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${transicionesDel.count} TransicionReporte`);

        const embeddingsDel = await prisma.embeddingReporte.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${embeddingsDel.count} EmbeddingReporte`);

        const fuentesDel = await prisma.fuenteReporte.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borradas ${fuentesDel.count} FuenteReporte`);

        const reintentosDel = await prisma.reintentoReporte.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borrados ${reintentosDel.count} ReintentoReporte`);

        const pasosDel = await prisma.pasoProcesamiento.deleteMany({
            where: { reporteId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borrados ${pasosDel.count} PasoProcesamiento`);

        const eventosDel = await prisma.eventoMatch.deleteMany({
            where: { reporteNuevoId: { in: reporteIds } },
        });
        console.log(`[purgar-demo] Borrados ${eventosDel.count} EventoMatch`);
    }

    // ------------------------------------------------------------------
    // Fase 2: derivadas de colegio
    // ------------------------------------------------------------------
    if (colegioIds.length > 0) {
        const patronesDel = await prisma.patronInstitucional.deleteMany({
            where: { colegioId: { in: colegioIds } },
        });
        console.log(`[purgar-demo] Borrados ${patronesDel.count} PatronInstitucional`);

        const avisosDel = await prisma.registroAvisoColegio.deleteMany({
            where: { colegioId: { in: colegioIds } },
        });
        console.log(`[purgar-demo] Borrados ${avisosDel.count} RegistroAvisoColegio`);

        const preferenciasDel = await prisma.preferenciaAlertaColegio.deleteMany({
            where: { colegioId: { in: colegioIds } },
        });
        console.log(`[purgar-demo] Borradas ${preferenciasDel.count} PreferenciaAlertaColegio`);
    }

    // ------------------------------------------------------------------
    // Fase 2-bis (SPEC-516): cadena de expediente (padre-derivada). Debe ir
    // ANTES de borrar el Usuario padre: `Expediente.padreUsuarioId` es NOT NULL.
    // Orden FK-safe: AclaracionExpediente → InformeConsolidado → PatronExpediente
    // → EventoExpediente → Expediente.
    // ------------------------------------------------------------------
    if (expedienteIds.length > 0) {
        const aclDel = await prisma.aclaracionExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
        console.log(`[purgar-demo] Borradas ${aclDel.count} AclaracionExpediente`);
        const infDel = await prisma.informeConsolidado.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
        console.log(`[purgar-demo] Borrados ${infDel.count} InformeConsolidado`);
        const patDel = await prisma.patronExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
        console.log(`[purgar-demo] Borrados ${patDel.count} PatronExpediente`);
        const evDel = await prisma.eventoExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
        console.log(`[purgar-demo] Borrados ${evDel.count} EventoExpediente`);
        // Self-relación: nullear antes de borrar para no chocar el FK.
        await prisma.expediente.updateMany({
            where: { id: { in: expedienteIds } },
            data: { expedienteRelacionadoAnteriorId: null },
        });
        const expDel = await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
        console.log(`[purgar-demo] Borrados ${expDel.count} Expediente`);
    }

    // ------------------------------------------------------------------
    // Fase 3: derivadas de estudiante
    // ------------------------------------------------------------------
    if (estudianteIds.length > 0) {
        const observacionesDel = await prisma.estudianteObservacion.deleteMany({
            where: { estudianteId: { in: estudianteIds } },
        });
        console.log(`[purgar-demo] Borradas ${observacionesDel.count} EstudianteObservacion`);

        const acudientesDel = await prisma.acudienteEstudiante.deleteMany({
            where: { estudianteId: { in: estudianteIds } },
        });
        console.log(`[purgar-demo] Borrados ${acudientesDel.count} AcudienteEstudiante`);

        const identEstDel = await prisma.identificadorEstudiante.deleteMany({
            where: { estudianteId: { in: estudianteIds } },
        });
        console.log(`[purgar-demo] Borrados ${identEstDel.count} IdentificadorEstudiante`);
    }

    // ------------------------------------------------------------------
    // Fase 4: IdentificadorReportado creado/afectado por reportes demo
    // Solo se borra si el identificador NO tiene reportes reales (no demo).
    // ------------------------------------------------------------------
    if (reporteIds.length > 0) {
        const afectadas = await prisma.$executeRawUnsafe(`
            DELETE FROM "IdentificadorReportado" ir
            WHERE ir.id IN (
                SELECT DISTINCT im.id
                FROM "IdentificadorReportado" im
                JOIN "Reporte" r ON r.identificador = im.identificador AND r."plataformaId" = im."plataformaId"
                WHERE r.id IN (SELECT "entidadId" FROM "demo_marcado" WHERE entidad = 'Reporte')
            )
            AND NOT EXISTS (
                SELECT 1
                FROM "Reporte" r2
                WHERE r2.identificador = ir.identificador AND r2."plataformaId" = ir."plataformaId"
                AND r2.id NOT IN (SELECT "entidadId" FROM "demo_marcado" WHERE entidad = 'Reporte')
            )
        `);
        console.log(`[purgar-demo] Borrados IdentificadorReportado afectados: ${afectadas}`);
    }

    // ------------------------------------------------------------------
    // Fase 5: entidades marcadas directamente (hojas primero, padres después).
    // El orden vive en ./lib/orden-borrado (fuente única, testeable).
    // ------------------------------------------------------------------
    for (const entidad of ORDEN_BORRADO) {
        const marcados = await prisma.demoMarcado.findMany({
            where: { entidad },
            select: { id: true, entidadId: true },
        });
        if (marcados.length === 0) continue;

        const ids = marcados.map((m) => m.entidadId);
        console.log(`[purgar-demo] Borrando ${marcados.length} filas de ${entidad}...`);

        switch (entidad) {
            case "Usuario": {
                await prisma.usuario.updateMany({
                    where: { id: { in: ids } },
                    data: { colegioId: null, tenantId: null },
                });
                await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Colegio": {
                await prisma.colegio.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Curso": {
                await prisma.curso.updateMany({
                    where: { id: { in: ids } },
                    data: { profesorTitularId: null },
                });
                await prisma.curso.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Reporte": {
                await prisma.reporte.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "AuditLog": {
                await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Estudiante": {
                await prisma.estudiante.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Profesor": {
                await prisma.profesor.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Tenant": {
                await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            default: {
                const modelName = entidad.charAt(0).toLowerCase() + entidad.slice(1);
                // @ts-expect-error — acceso dinámico a modelos Prisma
                const model = prisma[modelName];
                if (model && typeof model.deleteMany === "function") {
                    await model.deleteMany({ where: { id: { in: ids } } });
                } else {
                    console.warn(`[purgar-demo] No hay handler para ${entidad}; omitido`);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Fase 6: limpiar DemoMarcado
    // ------------------------------------------------------------------
    const limpiados = await prisma.demoMarcado.deleteMany();
    console.log(`[purgar-demo] Limpiados ${limpiados.count} registros de DemoMarcado`);

    const totalDespues = await contarDemo();
    console.log(`[purgar-demo] Registros DemoMarcado después: ${totalDespues}`);
    if (totalDespues > 0) {
        console.error("[purgar-demo] ERROR: quedaron registros sin borrar.");
        process.exit(1);
    }
    console.log("[purgar-demo] Purga completa.");
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
