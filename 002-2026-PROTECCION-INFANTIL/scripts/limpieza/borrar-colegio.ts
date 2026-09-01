/**
 * SPEC-265 (002-PI-168) — borra UN colegio y sus datos derivados.
 *
 * Uso (dry-run):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-colegio.ts \
 *     --id=<colegioId> --motivo="baja voluntaria colegio X"
 *
 * Uso (borrado real):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-colegio.ts \
 *     --id=<colegioId> --motivo="baja voluntaria colegio X" --confirm
 *
 * NO toca reportes de padres externos al tenant del colegio.
 * NO borra el usuario `soporte@innovadataco.com`.
 *
 * Estrategia: los reportes del tenant se borran uno a uno con borrarReporte()
 * para reutilizar su orden FK-safe. Las entidades hijas del colegio (cursos,
 * estudiantes, profesores, alertas, comité, onboarding, suscripciones) se
 * borran vía deleteMany en orden dependencias→padres dentro de una transacción.
 *
 * A-66: cubre el subárbol de A-58 (IdentificadorProfesor/Alumno/Acudiente +
 * AcudienteEstudiante + EstudianteObservacion + SolicitudComite) y resuelve
 * la trampa cross-tenant de AlertaColegio: una alerta del colegio Y puede
 * referenciar un identificador del colegio X, por lo que se buscan TODAS las
 * AlertaColegio que referencian los identificadores del colegio que se borra,
 * sin filtrar solo por colegioId.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs, requerirMotivo, registrarAuditoria, log } from "./_common";
import { borrarReporte } from "./borrar-reporte";

export interface ResultadoBorrarColegio {
    colegioId: string;
    tenantId: string;
    filasBorradas: number;
    detalle: Record<string, number>;
    dryRun: boolean;
}

export async function borrarColegio(
    colegioId: string,
    motivo: string,
    opts: { confirm: boolean; client?: PrismaClient } = { confirm: false },
): Promise<ResultadoBorrarColegio> {
    const client = opts.client ?? prisma;

    const colegio = await client.colegio.findUnique({
        where: { id: colegioId },
        select: {
            id: true,
            nombre: true,
            tenantId: true,
            admin: { select: { id: true, email: true } },
            comiteConvivencia: { select: { id: true, email: true } },
        },
    });
    if (!colegio) throw new Error(`[borrar-colegio] Colegio no encontrado: ${colegioId}`);

    const tenantId = colegio.tenantId;

    const reportesTenant = await client.reporte.findMany({
        where: { tenantId },
        select: { id: true },
    });
    const reporteIds = reportesTenant.map((r) => r.id);

    const detalle: Record<string, number> = {
        reportesTenant: reporteIds.length,
        solicitudesComite: await client.solicitudComite.count({ where: { alerta: { colegioId } } }),
        alertasColegio: await client.alertaColegio.count({ where: { colegioId } }),
        seguimientos: await client.seguimientoCaso.count({ where: { colegioId } }),
        notas: await client.notaSeguimiento.count({ where: { colegioId } }),
        identificadoresProfesor: await client.identificadorProfesor.count({ where: { colegioId } }),
        identificadoresEstudiante: await client.identificadorEstudiante.count({ where: { colegioId } }),
        identificadoresAcudiente: await client.identificadorAcudiente.count({ where: { colegioId } }),
        estudiantesObservacion: await client.estudianteObservacion.count({ where: { estudiante: { colegioId } } }),
        acudientesEstudiante: await client.acudienteEstudiante.count({ where: { estudiante: { colegioId } } }),
        integrantesComite: colegio.comiteConvivencia
            ? await client.integranteComite.count({ where: { comiteId: colegio.comiteConvivencia.id } })
            : 0,
        cursoMaterias: await client.cursoMateria.count({ where: { colegioId } }),
        cursos: await client.curso.count({ where: { colegioId } }),
        materias: await client.materia.count({ where: { colegioId } }),
        estudiantes: await client.estudiante.count({ where: { colegioId } }),
        profesores: await client.profesor.count({ where: { colegioId } }),
        patrones: await client.patronInstitucional.count({ where: { colegioId } }),
        cargasRoster: await client.cargaRosterSesion.count({ where: { colegioId } }),
        notificacionesInApp: await client.notificacionInApp.count({ where: { colegioId } }),
        preferenciasAvisos: await client.preferenciaAlertaColegio.count({ where: { colegioId } }),
        registrosAvisos: await client.registroAvisoColegio.count({ where: { colegioId } }),
        onboarding: await client.onboardingColegio.count({ where: { colegioId } }),
        suscripciones: await client.suscripcion.count({ where: { colegioId } }),
        usuarioAdmin: colegio.admin ? 1 : 0,
        usuarioComiteConvivencia: colegio.comiteConvivencia ? 1 : 0,
        colegio: 1,
        tenant: 1,
    };

    if (!opts.confirm) {
        log("borrar-colegio", `DRY-RUN colegio=${colegio.nombre} (${colegioId})`);
        for (const [k, v] of Object.entries(detalle)) log("borrar-colegio", `  · ${k}: ${v}`);
        return { colegioId, tenantId, filasBorradas: 0, detalle, dryRun: true };
    }

    // Reportes del tenant primero (uno a uno, cada uno transaccional).
    for (const id of reporteIds) {
        await borrarReporte(id, `${motivo} (colegio ${colegio.nombre})`, { confirm: true, client });
    }

    return client.$transaction(async (tx) => {
        // ── A-66 (a): trampa cross-tenant ──────────────────────────────────────
        // AlertaColegio cruza colegios: una alerta del colegio Y puede referenciar
        // un identificador del colegio X. Borrar solo WHERE colegioId=X deja esas
        // alertas vivas → FK al borrar los identificadores de X. Se buscan TODAS
        // las AlertaColegio que referencian los identificadores de ESTE colegio.

        const identProfIds = (await tx.identificadorProfesor.findMany({
            where: { colegioId }, select: { id: true },
        })).map((i) => i.id);
        const identEstIds = (await tx.identificadorEstudiante.findMany({
            where: { colegioId }, select: { id: true },
        })).map((i) => i.id);
        const identAcuIds = (await tx.identificadorAcudiente.findMany({
            where: { colegioId }, select: { id: true },
        })).map((i) => i.id);

        const orIdentClause = [
            ...(identProfIds.length > 0 ? [{ identificadorProfesorId: { in: identProfIds } }] : []),
            ...(identEstIds.length > 0 ? [{ identificadorEstudianteId: { in: identEstIds } }] : []),
            ...(identAcuIds.length > 0 ? [{ identificadorAcudienteId: { in: identAcuIds } }] : []),
        ];

        // Unión: alertas propias del colegio + alertas cross-tenant por identificador
        const todasAlertas = await tx.alertaColegio.findMany({
            where: { OR: [{ colegioId }, ...orIdentClause] },
            select: { id: true },
        });
        const todasAlertaIds = todasAlertas.map((a) => a.id);

        if (todasAlertaIds.length > 0) {
            // SolicitudComite → AlertaColegio (alertaColegioId @unique FK)
            await tx.solicitudComite.deleteMany({ where: { alertaColegioId: { in: todasAlertaIds } } });
            // SeguimientoCaso → AlertaColegio (alertaId @unique FK)
            const seguimientos = await tx.seguimientoCaso.findMany({
                where: { alertaId: { in: todasAlertaIds } }, select: { id: true },
            });
            if (seguimientos.length > 0) {
                // NotaSeguimiento → SeguimientoCaso (seguimientoId FK)
                await tx.notaSeguimiento.deleteMany({
                    where: { seguimientoId: { in: seguimientos.map((s) => s.id) } },
                });
                // SPEC-351: InformeCaso SIN Cascade (evidencia, decisión CEO) —
                // se borra explícito ANTES del caso o la FK RESTRICT bloquea.
                await tx.informeCaso.deleteMany({
                    where: { casoId: { in: seguimientos.map((s) => s.id) } },
                });
                await tx.seguimientoCaso.deleteMany({
                    where: { id: { in: seguimientos.map((s) => s.id) } },
                });
            }
            await tx.alertaColegio.deleteMany({ where: { id: { in: todasAlertaIds } } });
        }

        // ── Resto del árbol del colegio ─────────────────────────────────────────
        if (colegio.comiteConvivencia) {
            await tx.integranteComite.deleteMany({ where: { comiteId: colegio.comiteConvivencia.id } });
        }
        await tx.cursoMateria.deleteMany({ where: { colegioId } });
        await tx.materia.deleteMany({ where: { colegioId } });

        // A-66: identificadores (ya sin alertas que los referencien)
        await tx.identificadorProfesor.deleteMany({ where: { colegioId } });
        await tx.identificadorEstudiante.deleteMany({ where: { colegioId } });
        await tx.identificadorAcudiente.deleteMany({ where: { colegioId } });

        // A-66: EstudianteObservacion y AcudienteEstudiante (referencian Estudiante)
        const estudiantesIds = (await tx.estudiante.findMany({
            where: { colegioId }, select: { id: true },
        })).map((e) => e.id);
        if (estudiantesIds.length > 0) {
            await tx.estudianteObservacion.deleteMany({ where: { estudianteId: { in: estudiantesIds } } });
            await tx.acudienteEstudiante.deleteMany({ where: { estudianteId: { in: estudiantesIds } } });
        }

        await tx.estudiante.deleteMany({ where: { colegioId } });
        await tx.profesor.deleteMany({ where: { colegioId } });
        await tx.curso.deleteMany({ where: { colegioId } });
        await tx.patronInstitucional.deleteMany({ where: { colegioId } });
        await tx.cargaRosterSesion.deleteMany({ where: { colegioId } });
        await tx.notificacionInApp.deleteMany({ where: { colegioId } });
        await tx.preferenciaAlertaColegio.deleteMany({ where: { colegioId } });
        await tx.registroAvisoColegio.deleteMany({ where: { colegioId } });
        await tx.onboardingColegio.deleteMany({ where: { colegioId } });
        await tx.suscripcion.deleteMany({ where: { colegioId } });

        // Expedientes de admin/comiteConvivencia: borrar en orden FK-safe antes del usuario.
        // borrarReporte (ejecutado antes) ya puso EventoExpediente.reporteId = null
        // para los reportes del tenant. Los expedientes de estos usuarios se limpian aquí.
        const usuariosColegio = [colegio.admin?.id, colegio.comiteConvivencia?.id].filter(
            (id): id is string => !!id,
        );
        if (usuariosColegio.length > 0) {
            const expsColegio = await tx.expediente.findMany({
                where: { padreUsuarioId: { in: usuariosColegio } },
                select: { id: true },
            });
            const expColegioIds = expsColegio.map((e) => e.id);
            if (expColegioIds.length > 0) {
                await tx.expediente.updateMany({
                    where: { id: { in: expColegioIds } },
                    data: { expedienteRelacionadoAnteriorId: null },
                });
                await tx.aclaracionExpediente.deleteMany({ where: { expedienteId: { in: expColegioIds } } });
                await tx.informeConsolidado.deleteMany({ where: { expedienteId: { in: expColegioIds } } });
                await tx.patronExpediente.deleteMany({ where: { expedienteId: { in: expColegioIds } } });
                await tx.eventoExpediente.deleteMany({ where: { expedienteId: { in: expColegioIds } } });
                await tx.expediente.deleteMany({ where: { padreUsuarioId: { in: usuariosColegio } } });
            }
        }

        if (colegio.admin) await tx.usuario.delete({ where: { id: colegio.admin.id } });
        if (colegio.comiteConvivencia) await tx.usuario.delete({ where: { id: colegio.comiteConvivencia.id } });

        await tx.colegio.delete({ where: { id: colegioId } });
        await tx.tenant.delete({ where: { id: tenantId } });

        const total = Object.values(detalle).reduce((a, b) => a + b, 0);
        await registrarAuditoria(tx, "colegio", motivo, total, [colegioId]);
        log("borrar-colegio", `REALIZADO colegio=${colegioId} filas=${total}`);
        return { colegioId, tenantId, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const id = typeof args.id === "string" ? args.id : "";
    if (!id) throw new Error("[borrar-colegio] Falta --id=<colegioId>");
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await borrarColegio(id, motivo, { confirm });
}

if (process.argv[1]?.endsWith("borrar-colegio.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-colegio] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
