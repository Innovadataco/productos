/**
 * SPEC-265 (002-PI-168) — borra UN usuario PARENT y sus datos personales.
 *
 * Uso (dry-run):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-padre.ts \
 *     --email=<email> --motivo="baja voluntaria"
 *
 * Uso (borrado real):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-padre.ts \
 *     --email=<email> --motivo="baja voluntaria" --confirm
 *
 * NO toca colegios. NO toca `soporte@innovadataco.com`.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs, requerirMotivo, registrarAuditoria, log, PRESERVADOS, bloquearSiHayConsentimiento, contarConsentimientos } from "./_common";
import { borrarReporte } from "./borrar-reporte";

export interface ResultadoBorrarPadre {
    usuarioId: string;
    email: string;
    filasBorradas: number;
    detalle: {
        contactos: number;
        reportes: number;
        codigosVerificacion: number;
        tokensRecuperacion: number;
        suscripciones: number;
        expedientes: number;
        consentimientos: number;
        usuario: number;
    };
    dryRun: boolean;
}

export async function borrarPadre(
    email: string,
    motivo: string,
    opts: { confirm: boolean; client?: PrismaClient } = { confirm: false },
): Promise<ResultadoBorrarPadre> {
    const client = opts.client ?? prisma;

    if (PRESERVADOS.usuarios.includes(email as (typeof PRESERVADOS.usuarios)[number])) {
        throw new Error(`[borrar-padre] Usuario preservado: ${email}`);
    }

    const usuario = await client.usuario.findUnique({
        where: { email },
        select: { id: true, email: true, rol: true },
    });
    if (!usuario) throw new Error(`[borrar-padre] Usuario no encontrado: ${email}`);
    if (usuario.rol !== "PARENT") {
        throw new Error(`[borrar-padre] Rol distinto de PARENT: ${usuario.rol}. Script solo borra padres.`);
    }

    const reportes = await client.reporte.findMany({
        where: { usuarioId: usuario.id },
        select: { id: true },
    });
    const reporteIds = reportes.map((r) => r.id);

    const expedientesUsuario = await client.expediente.findMany({
        where: { padreUsuarioId: usuario.id },
        select: { id: true },
    });
    const expedienteIds = expedientesUsuario.map((e) => e.id);

    const conteoDetalle = {
        contactos: await client.contactoConfianza.count({ where: { usuarioId: usuario.id } }),
        reportes: reporteIds.length,
        codigosVerificacion: await client.codigoVerificacion.count({ where: { usuarioId: usuario.id } }),
        tokensRecuperacion: await client.tokenRecuperacion.count({ where: { usuarioId: usuario.id } }),
        suscripciones: await client.suscripcion.count({ where: { usuarioId: usuario.id } }),
        expedientes: expedienteIds.length,
        // SPEC-508: constancias de consentimiento que el cascade destruiría (evidencia legal).
        consentimientos: await contarConsentimientos(client, [usuario.id]),
        usuario: 1,
    };

    if (!opts.confirm) {
        log("borrar-padre", `DRY-RUN padre=${email} (${usuario.id})`);
        log("borrar-padre", `  · ContactoConfianza: ${conteoDetalle.contactos} (cascade IdentificadorContacto)`);
        log("borrar-padre", `  · Reporte: ${conteoDetalle.reportes} (con sus derivados)`);
        log("borrar-padre", `  · CodigoVerificacion: ${conteoDetalle.codigosVerificacion}`);
        log("borrar-padre", `  · TokenRecuperacion: ${conteoDetalle.tokensRecuperacion}`);
        log("borrar-padre", `  · Suscripcion: ${conteoDetalle.suscripciones}`);
        log("borrar-padre", `  · Expediente (+ AclaracionExpediente, InformeConsolidado, PatronExpediente, EventoExpediente): ${conteoDetalle.expedientes}`);
        log("borrar-padre", `  · AuditConsentimiento (EVIDENCIA LEGAL — el borrado se NIEGA si > 0, SPEC-508): ${conteoDetalle.consentimientos}`);
        log("borrar-padre", "  · Usuario: 1");
        return { usuarioId: usuario.id, email, filasBorradas: 0, detalle: conteoDetalle, dryRun: true };
    }

    // SPEC-508 · para el sangrado del P1-A: no destruir la evidencia de
    // consentimiento por el cascade. Si el padre tiene constancias, se NIEGA
    // antes de borrar nada (ni reportes, ni la transacción del usuario).
    await bloquearSiHayConsentimiento(client, [usuario.id], `padre ${email}`);

    // Los reportes se borran uno a uno (fuera de la transacción del usuario
    // para reutilizar el orden FK-safe validado). Cada uno ya es transaccional.
    for (const id of reporteIds) {
        await borrarReporte(id, `${motivo} (padre ${email})`, { confirm: true, client });
    }

    return client.$transaction(async (tx) => {
        // Expedientes del padre: borrar en orden FK-safe antes de borrar el Usuario.
        // Orden: nullear self-relation → AclaracionExpediente → InformeConsolidado →
        // PatronExpediente → EventoExpediente → Expediente.
        // borrarReporte (ejecutado antes) ya puso EventoExpediente.reporteId = null.
        if (expedienteIds.length > 0) {
            await tx.expediente.updateMany({
                where: { id: { in: expedienteIds } },
                data: { expedienteRelacionadoAnteriorId: null },
            });
            await tx.aclaracionExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
            await tx.informeConsolidado.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
            await tx.patronExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
            await tx.eventoExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
            await tx.expediente.deleteMany({ where: { padreUsuarioId: usuario.id } });
        }

        const cc = await tx.contactoConfianza.deleteMany({ where: { usuarioId: usuario.id } });
        const cv = await tx.codigoVerificacion.deleteMany({ where: { usuarioId: usuario.id } });
        const tr = await tx.tokenRecuperacion.deleteMany({ where: { usuarioId: usuario.id } });
        const su = await tx.suscripcion.deleteMany({ where: { usuarioId: usuario.id } });
        const u = await tx.usuario.delete({ where: { id: usuario.id } });

        const detalle = {
            contactos: cc.count,
            reportes: reporteIds.length,
            codigosVerificacion: cv.count,
            tokensRecuperacion: tr.count,
            suscripciones: su.count,
            expedientes: expedienteIds.length,
            consentimientos: 0, // SPEC-508: garantizado 0 acá (el guard ya se negó si había).
            usuario: u ? 1 : 0,
        };
        const total = Object.values(detalle).reduce((a, b) => a + b, 0);

        await registrarAuditoria(tx, "padre", motivo, total, [usuario.id]);
        log("borrar-padre", `REALIZADO padre=${email} filas=${total}`);
        return { usuarioId: usuario.id, email, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["email", "motivo", "confirm"]);
    const email = typeof args.email === "string" ? args.email : "";
    if (!email) throw new Error("[borrar-padre] Falta --email=<email>");
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await borrarPadre(email, motivo, { confirm });
}

if (process.argv[1]?.endsWith("borrar-padre.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-padre] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
