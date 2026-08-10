#!/usr/bin/env tsx
/**
 * Purga quirúrgica de datos demo. Borra EXCLUSIVAMENTE por DemoMarcado.id.
 * Uso:
 *   node --env-file=.env.test --import tsx scripts/demo-prod/purgar-demo.ts [--dry-run]
 */
import { prisma } from "./lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// Orden de borrado: hojas y dependientes primero, padres después.
// Se basa en las FK del schema; relaciones sin cascade requieren orden explícito.
const ORDEN_BORRADO: string[] = [
    "AuditLog",
    "NotaSeguimiento",
    "SeguimientoCaso",
    "EventoMatch",
    "AlertaColegio",
    "PatronInstitucional",
    "RegistroAvisoColegio",
    "PreferenciaAlertaColegio",
    "CargaRosterSesion",
    "ClasificacionIA",
    "EmbeddingReporte",
    "FuenteReporte",
    "TransicionReporte",
    "ReintentoReporte",
    "PasoProcesamiento",
    "SolicitudComite",
    "Reporte",
    "IdentificadorReportado",
    "IdentificadorContacto",
    "ContactoConfianza",
    "AlertaSuscripcion",
    "PerfilOperador",
    "IntegranteComite",
    "IdentificadorEstudiante",
    "AcudienteEstudiante",
    "EstudianteObservacion",
    "Estudiante",
    "Curso",
    "Profesor",
    "Usuario",
    "Colegio",
    "Tenant",
];

async function contarDemo(): Promise<number> {
    return prisma.demoMarcado.count();
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
                // Desvincular referencias circulares antes de borrar
                await prisma.usuario.updateMany({ where: { id: { in: ids } }, data: { colegioId: null, tenantId: null } });
                await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Colegio": {
                await prisma.colegio.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "Curso": {
                await prisma.curso.updateMany({ where: { id: { in: ids } }, data: { profesorTitularId: null } });
                await prisma.curso.deleteMany({ where: { id: { in: ids } } });
                break;
            }
            case "IdentificadorReportado": {
                await prisma.identificadorReportado.deleteMany({ where: { id: { in: ids } } });
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
            default: {
                // Intentar borrado genérico a través de Prisma si el modelo existe
                const modelName = entidad.charAt(0).toLowerCase() + entidad.slice(1);
                // @ts-expect-error — acceso dinámico
                const model = prisma[modelName];
                if (model && typeof model.deleteMany === "function") {
                    await model.deleteMany({ where: { id: { in: ids } } });
                } else {
                    console.warn(`[purgar-demo] No hay handler para ${entidad}; omitido`);
                }
            }
        }

        // Limpiar DemoMarcado de esta entidad
        await prisma.demoMarcado.deleteMany({ where: { entidad } });
    }

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
