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
 * ALCANCE EXPLÍCITO (SPEC-679, I-405): este script REHÚSA correr sin un alcance
 * declarado. `demo_marcado` puede tener VARIAS corridas conviviendo (demo-002-PI-059,
 * spec-412-v5, red-apoyo-676, …); una purga sin filtro borra TODAS. Un poblador
 * incremental que quiera «re-sembrar lo mío» debe pasar `--corrida <suya>`, no una
 * purga total disfrazada. Modos:
 *   --dry-run              inspecciona (read-only), no borra.
 *   --corrida <nombre>     borra SOLO esa corrida (filtra TODAS las fases + el limpiado final).
 *   --confirmar-total      borra TODO lo marcado, de TODAS las corridas (arrasar es la intención).
 * Sin ninguno → error. --confirmar-total y --corrida son mutuamente excluyentes.
 *
 * Uso:
 *   node --env-file=.env.test --import tsx scripts/demo-prod/purgar-demo.ts --dry-run
 *   node --env-file=.env --import tsx scripts/demo-prod/purgar-demo.ts --corrida demo-002-PI-059
 *   node --env-file=.env --import tsx scripts/demo-prod/purgar-demo.ts --confirmar-total
 */
import { pathToFileURL } from "node:url";
import type { Prisma } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { ORDEN_BORRADO } from "./lib/orden-borrado";

/** Filtro de corrida: undefined = TODAS (total); un nombre = solo esa corrida. */
function corridaWhere(corrida?: string): Prisma.DemoMarcadoWhereInput {
    return corrida ? { metadata: { path: ["corrida"], equals: corrida } } : {};
}

async function contarMarcas(corrida?: string): Promise<number> {
    return prisma.demoMarcado.count({ where: corridaWhere(corrida) });
}

async function entidadDemoIds(entidad: string, corrida?: string): Promise<string[]> {
    const rows = await prisma.demoMarcado.findMany({
        where: { entidad, ...corridaWhere(corrida) },
        select: { entidadId: true },
    });
    return rows.map((r) => r.entidadId);
}

export interface PurgaOpts {
    /** undefined = purga TOTAL (todas las corridas). Un nombre = SOLO esa corrida. */
    corrida?: string | undefined;
    dryRun?: boolean | undefined;
}

/**
 * Borra las filas de UNA entidad marcada, por id. El orden FK-safe (hoja→padre) lo
 * garantiza el caller recorriendo ORDEN_BORRADO; acá solo se resuelve el delegado Prisma
 * (algunas entidades necesitan nullear vínculos antes de borrar).
 */
async function borrarEntidadMarcada(entidad: string, ids: string[]): Promise<void> {
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
        default: {
            const modelName = entidad.charAt(0).toLowerCase() + entidad.slice(1);
            // @ts-expect-error — acceso dinámico a modelos Prisma; el nombre viene de
            // ORDEN_BORRADO, que el candado de pertenencia cruza contra lo que se marca.
            const model = prisma[modelName];
            if (model && typeof model.deleteMany === "function") {
                await model.deleteMany({ where: { id: { in: ids } } });
            } else {
                console.warn(`[purgar-demo] No hay handler para ${entidad}; omitido`);
            }
        }
    }
}

/**
 * Ejecuta la purga. Testeable: no lee argv, no hace `process.exit` ni `$disconnect`
 * (eso lo hace `main`). Lanza si algo queda sin borrar dentro del alcance.
 */
export async function purgar({ corrida, dryRun = false }: PurgaOpts): Promise<void> {
    const alcance = corrida ? `corrida ${corrida}` : "TODAS las corridas";
    const totalAntes = await contarMarcas(corrida);
    console.log(`[purgar-demo] Marcas en alcance (${alcance}): ${totalAntes}`);
    if (totalAntes === 0) {
        console.log("[purgar-demo] Nada que purgar.");
        return;
    }

    if (dryRun) {
        const porEntidad = await prisma.demoMarcado.groupBy({
            by: ["entidad"],
            _count: { entidad: true },
            where: corridaWhere(corrida),
        });
        console.log(`[purgar-demo] DRY-RUN (${alcance}) — entidades a borrar:`);
        for (const row of porEntidad) {
            console.log(`  ${row.entidad}: ${row._count.entidad}`);
        }
        return;
    }

    const reporteIds = await entidadDemoIds("Reporte", corrida);
    const estudianteIds = await entidadDemoIds("Estudiante", corrida);
    const colegioIds = await entidadDemoIds("Colegio", corrida);
    // SPEC-516: expedientes demo (padre-derivados; su cadena no la cubre el reporte).
    const expedienteIds = await entidadDemoIds("Expediente", corrida);

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
    // Fase 4: IdentificadorReportado creado/afectado por reportes demo EN ALCANCE.
    // Solo se borra si el identificador NO tiene reportes FUERA del alcance (reales
    // u otra corrida): esos lo siguen necesitando. Parametrizado por reporteIds (ya
    // filtrados por corrida) → el scope de `--corrida` NO se cuela a otra corrida.
    // ------------------------------------------------------------------
    if (reporteIds.length > 0) {
        const afectadas = await prisma.$executeRawUnsafe(
            `
            DELETE FROM "IdentificadorReportado" ir
            WHERE ir.id IN (
                SELECT DISTINCT im.id
                FROM "IdentificadorReportado" im
                JOIN "Reporte" r ON r.identificador = im.identificador AND r."plataformaId" = im."plataformaId"
                WHERE r.id = ANY($1::text[])
            )
            AND NOT EXISTS (
                SELECT 1
                FROM "Reporte" r2
                WHERE r2.identificador = ir.identificador AND r2."plataformaId" = ir."plataformaId"
                AND r2.id <> ALL($1::text[])
            )
        `,
            reporteIds,
        );
        console.log(`[purgar-demo] Borrados IdentificadorReportado afectados: ${afectadas}`);
    }

    // ------------------------------------------------------------------
    // Fase 5: entidades marcadas directamente (hojas primero, padres después).
    // El orden vive en ./lib/orden-borrado (fuente única, testeable).
    // ------------------------------------------------------------------
    for (const entidad of ORDEN_BORRADO) {
        const marcados = await prisma.demoMarcado.findMany({
            where: { entidad, ...corridaWhere(corrida) },
            select: { id: true, entidadId: true },
        });
        if (marcados.length === 0) continue;

        const ids = marcados.map((m) => m.entidadId);
        console.log(`[purgar-demo] Borrando ${marcados.length} filas de ${entidad}...`);
        await borrarEntidadMarcada(entidad, ids);
    }

    // ------------------------------------------------------------------
    // Fase 6: limpiar DemoMarcado — SOLO del alcance (--corrida NO borra las
    // marcas de otras corridas; si no filtrara acá, el flag mentiría).
    // ------------------------------------------------------------------
    const limpiados = await prisma.demoMarcado.deleteMany({ where: corridaWhere(corrida) });
    console.log(`[purgar-demo] Limpiados ${limpiados.count} registros de DemoMarcado (${alcance})`);

    // La verificación final es POR ALCANCE: tras purgar una corrida, las marcas de
    // OTRAS corridas siguen ahí legítimamente — contarlas como «sin borrar» era el bug.
    const totalDespues = await contarMarcas(corrida);
    if (totalDespues > 0) {
        throw new Error(`[purgar-demo] Quedaron ${totalDespues} marcas sin borrar en alcance (${alcance}).`);
    }
    console.log(`[purgar-demo] Purga completa (${alcance}).`);
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const confirmarTotal = args.includes("--confirmar-total");
    const corridaIdx = args.indexOf("--corrida");
    const corrida = corridaIdx >= 0 ? args[corridaIdx + 1] : undefined;

    if (corridaIdx >= 0 && (!corrida || corrida.startsWith("--"))) {
        console.error("[purgar-demo] --corrida requiere un nombre de corrida.");
        process.exit(1);
    }
    if (confirmarTotal && corrida) {
        console.error("[purgar-demo] --confirmar-total y --corrida son mutuamente excluyentes.");
        process.exit(1);
    }
    if (!dryRun && !confirmarTotal && !corrida) {
        console.error(
            "[purgar-demo] REHÚSO: purga sin alcance explícito. Pasá --corrida <nombre> (solo esa corrida) " +
            "o --confirmar-total (TODO lo marcado, de TODAS las corridas). --dry-run para inspeccionar.",
        );
        process.exit(1);
    }

    try {
        await purgar({ corrida, dryRun });
    } finally {
        await prisma.$disconnect();
    }
}

// Solo corre como script (o cuando lo lanza otro script vía spawn), NO al importarse:
// el candado importa `purgar` para ejercitarlo sin disparar una purga al cargar el módulo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
}
