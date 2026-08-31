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
        alertasColegio: await client.alertaColegio.count({ where: { colegioId } }),
        seguimientos: await client.seguimientoCaso.count({ where: { colegioId } }),
        notas: await client.notaSeguimiento.count({ where: { colegioId } }),
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
        await tx.notaSeguimiento.deleteMany({ where: { colegioId } });
        await tx.seguimientoCaso.deleteMany({ where: { colegioId } });
        await tx.alertaColegio.deleteMany({ where: { colegioId } });
        if (colegio.comiteConvivencia) {
            await tx.integranteComite.deleteMany({ where: { comiteId: colegio.comiteConvivencia.id } });
        }
        await tx.cursoMateria.deleteMany({ where: { colegioId } });
        await tx.materia.deleteMany({ where: { colegioId } });
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
