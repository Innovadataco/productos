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
import { borrarSubarbolExpediente } from "./_borrar-expediente";
import { borrarRastroUsuario, rastroVacio, type RastroUsuarioDetalle } from "./_borrar-usuario";

export interface ResultadoBorrarPadre {
    usuarioId: string;
    email: string;
    filasBorradas: number;
    detalle: {
        reportes: number;
        expedientes: number;
        consentimientos: number;
        // SPEC-905: el rastro genérico (citas, facturación, apelaciones, alertas, contactos, etc.)
        // lo borra `borrarRastroUsuario` — una sola fuente del orden FK-safe compartida con borrar-profesional.
        rastro: RastroUsuarioDetalle;
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

    // SPEC-508: constancias de consentimiento que el cascade destruiría (evidencia legal).
    const consentimientos = await contarConsentimientos(client, [usuario.id]);

    if (!opts.confirm) {
        const contactos = await client.contactoConfianza.count({ where: { usuarioId: usuario.id } });
        const suscripciones = await client.suscripcion.count({ where: { usuarioId: usuario.id } });
        const solicitudesCita = await client.solicitudCita.count({ where: { padreUsuarioId: usuario.id } });
        const apelaciones = await client.apelacion.count({ where: { usuarioId: usuario.id } });
        log("borrar-padre", `DRY-RUN padre=${email} (${usuario.id})`);
        log("borrar-padre", `  · Reporte: ${reporteIds.length} (con sus derivados)`);
        log("borrar-padre", `  · Expediente (+ AclaracionExpediente, InformeConsolidado, PatronExpediente, EventoExpediente): ${expedienteIds.length}`);
        log("borrar-padre", `  · SolicitudCita (como padre): ${solicitudesCita}`);
        log("borrar-padre", `  · Suscripcion: ${suscripciones} (+ Pago/BonoAplicado/CodigoReferidoUso que la bloquean, SPEC-905)`);
        log("borrar-padre", `  · Apelacion: ${apelaciones} (cascade: DocumentoApelacion, AccesoDocumentoApelacion)`);
        log("borrar-padre", `  · ContactoConfianza: ${contactos} (+ AlertaSuscripcion, ContactoEmergencia, DigestSemanal, NotificacionInApp, CodigoAccesoContenido, codigos/tokens)`);
        log("borrar-padre", `  · AuditConsentimiento (EVIDENCIA LEGAL — el borrado se NIEGA si > 0, SPEC-508): ${consentimientos}`);
        log("borrar-padre", "  · Usuario: 1");
        return {
            usuarioId: usuario.id, email, filasBorradas: 0,
            detalle: {
                reportes: reporteIds.length, expedientes: expedienteIds.length, consentimientos,
                rastro: rastroVacio(),
                usuario: 1,
            },
            dryRun: true,
        };
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
        // SPEC-615 (I-374): el subárbol del expediente en orden FK-safe, en UN solo lugar
        // (`borrarSubarbolExpediente`). Antes estaba duplicado acá y en borrar-colegio, y ambas
        // copias olvidaron InformePadre → la purga abortaba en expediente.deleteMany.
        // borrarReporte (ejecutado antes) ya puso EventoExpediente.reporteId = null.
        await borrarSubarbolExpediente(tx, expedienteIds);

        // SPEC-905: el resto del rastro genérico (citas como padre, facturación → Suscripcion,
        // apelaciones, alertas, contactos, códigos) en orden FK-safe, compartido con borrar-profesional.
        const rastro = await borrarRastroUsuario(tx, [usuario.id]);
        const u = await tx.usuario.delete({ where: { id: usuario.id } });

        const detalle = {
            reportes: reporteIds.length,
            expedientes: expedienteIds.length,
            consentimientos: 0, // SPEC-508: garantizado 0 acá (el guard ya se negó si había).
            rastro,
            usuario: u ? 1 : 0,
        };
        const total =
            detalle.reportes + detalle.expedientes + detalle.usuario +
            Object.values(rastro).reduce((a, b) => a + b, 0);

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
