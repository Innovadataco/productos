/**
 * SPEC-905 — borra UN usuario PROFESIONAL (A-75) y su subárbol de agenda/verificación.
 *
 * Uso (dry-run):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-profesional.ts \
 *     --email=<email> --motivo="baja profesional X"
 *
 * Uso (borrado real):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-profesional.ts \
 *     --email=<email> --motivo="baja profesional X" --confirm
 *
 * NO toca `soporte@innovadataco.com`. NO destruye evidencia de consentimiento: si el
 * profesional tuviera constancias, se NIEGA (guard SPEC-508 intacto, igual que borrar-padre).
 *
 * Orden FK-safe del subárbol profesional (pg_constraint):
 *   SolicitudCita(profesionalId) → FranjaDisponible → VerificacionProfesional →
 *   PerfilProfesional (cascade: DocumentoProfesional→VerificacionDocumento/RevisionRenovacion,
 *   DiaBloqueado) → AceptacionAutorizacionProfesional (cascade del Usuario, ya sin verificación
 *   que la referencie) → rastro genérico del usuario → Usuario.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs, requerirMotivo, registrarAuditoria, log, PRESERVADOS, bloquearSiHayConsentimiento, contarConsentimientos } from "./_common";
import { borrarRastroUsuario } from "./_borrar-usuario";

export interface ResultadoBorrarProfesional {
    usuarioId: string;
    email: string;
    filasBorradas: number;
    detalle: {
        solicitudesCitaProfesional: number;
        franjas: number;
        verificaciones: number;
        aceptacionesAutorizacion: number;
        perfilProfesional: number;
        consentimientos: number;
        rastro: number;
        usuario: number;
    };
    dryRun: boolean;
}

export async function borrarProfesional(
    email: string,
    motivo: string,
    opts: { confirm: boolean; client?: PrismaClient } = { confirm: false },
): Promise<ResultadoBorrarProfesional> {
    const client = opts.client ?? prisma;

    if (PRESERVADOS.usuarios.includes(email as (typeof PRESERVADOS.usuarios)[number])) {
        throw new Error(`[borrar-profesional] Usuario preservado: ${email}`);
    }

    const usuario = await client.usuario.findUnique({
        where: { email },
        select: { id: true, email: true, rol: true },
    });
    if (!usuario) throw new Error(`[borrar-profesional] Usuario no encontrado: ${email}`);
    if (usuario.rol !== "PROFESIONAL") {
        throw new Error(`[borrar-profesional] Rol distinto de PROFESIONAL: ${usuario.rol}. Script solo borra profesionales.`);
    }

    const perfil = await client.perfilProfesional.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
    });

    const perfilId = perfil?.id;
    const conteo = {
        solicitudesCitaProfesional: perfilId
            ? await client.solicitudCita.count({ where: { profesionalId: perfilId } })
            : 0,
        franjas: perfilId ? await client.franjaDisponible.count({ where: { profesionalId: perfilId } }) : 0,
        verificaciones: perfilId
            ? await client.verificacionProfesional.count({ where: { perfilProfesionalId: perfilId } })
            : 0,
        aceptacionesAutorizacion: await client.aceptacionAutorizacionProfesional.count({ where: { usuarioId: usuario.id } }),
        perfilProfesional: perfil ? 1 : 0,
        // SPEC-508: el guard se mantiene también para el profesional (evidencia legal).
        consentimientos: await contarConsentimientos(client, [usuario.id]),
    };

    if (!opts.confirm) {
        log("borrar-profesional", `DRY-RUN profesional=${email} (${usuario.id}) perfil=${perfilId ?? "ninguno"}`);
        log("borrar-profesional", `  · SolicitudCita (como profesional): ${conteo.solicitudesCitaProfesional}`);
        log("borrar-profesional", `  · FranjaDisponible: ${conteo.franjas}`);
        log("borrar-profesional", `  · VerificacionProfesional: ${conteo.verificaciones} (cascade: VerificacionDocumento)`);
        log("borrar-profesional", `  · AceptacionAutorizacionProfesional: ${conteo.aceptacionesAutorizacion}`);
        log("borrar-profesional", `  · PerfilProfesional: ${conteo.perfilProfesional} (cascade: DocumentoProfesional, RevisionRenovacion, DiaBloqueado)`);
        log("borrar-profesional", `  · AuditConsentimiento (EVIDENCIA LEGAL — se NIEGA si > 0, SPEC-508): ${conteo.consentimientos}`);
        log("borrar-profesional", "  · + rastro genérico del usuario (citas como padre, suscripción/facturación, alertas, etc.) + Usuario");
        return {
            usuarioId: usuario.id, email, filasBorradas: 0,
            detalle: { ...conteo, rastro: 0, usuario: 0 }, dryRun: true,
        };
    }

    // SPEC-508 (guard intacto): si el profesional tiene constancias de consentimiento, se NIEGA
    // antes de borrar nada. El reset --purga-total borra audit_consentimientos ANTES (documentado),
    // así que allí este guard ve 0 y pasa; en el borrado quirúrgico la evidencia se preserva.
    await bloquearSiHayConsentimiento(client, [usuario.id], `profesional ${email}`);

    return client.$transaction(async (tx) => {
        if (perfilId) {
            await tx.solicitudCita.deleteMany({ where: { profesionalId: perfilId } });
            await tx.franjaDisponible.deleteMany({ where: { profesionalId: perfilId } });
            await tx.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: perfilId } });
            // PerfilProfesional cascade: DocumentoProfesional → VerificacionDocumento + RevisionRenovacion; DiaBloqueado.
            await tx.perfilProfesional.delete({ where: { id: perfilId } });
        }
        // AceptacionAutorizacion (usuarioId → Usuario Cascade): la verificación que la referenciaba
        // (Restrict) ya cayó arriba, así que el Cascade del Usuario puede llevársela; se borra
        // explícito acá para contarla y no depender del orden del cascade.
        const ac = await tx.aceptacionAutorizacionProfesional.deleteMany({ where: { usuarioId: usuario.id } });

        const rastro = await borrarRastroUsuario(tx, [usuario.id]);
        const rastroTotal = Object.values(rastro).reduce((a, b) => a + b, 0);

        const u = await tx.usuario.delete({ where: { id: usuario.id } });

        const detalle = {
            ...conteo,
            consentimientos: 0, // garantizado 0 (el guard ya se negó si había).
            aceptacionesAutorizacion: ac.count,
            rastro: rastroTotal,
            usuario: u ? 1 : 0,
        };
        const total = Object.values(detalle).reduce((a, b) => a + b, 0);

        await registrarAuditoria(tx, "profesional", motivo, total, [usuario.id]);
        log("borrar-profesional", `REALIZADO profesional=${email} filas=${total}`);
        return { usuarioId: usuario.id, email, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["email", "motivo", "confirm"]);
    const email = typeof args.email === "string" ? args.email : "";
    if (!email) throw new Error("[borrar-profesional] Falta --email=<email>");
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await borrarProfesional(email, motivo, { confirm });
}

if (process.argv[1]?.endsWith("borrar-profesional.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-profesional] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
