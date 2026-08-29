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
import { parseArgs, requerirMotivo, registrarAuditoria, log, PRESERVADOS } from "./_common";
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

    const conteoDetalle = {
        contactos: await client.contactoConfianza.count({ where: { usuarioId: usuario.id } }),
        reportes: reporteIds.length,
        codigosVerificacion: await client.codigoVerificacion.count({ where: { usuarioId: usuario.id } }),
        tokensRecuperacion: await client.tokenRecuperacion.count({ where: { usuarioId: usuario.id } }),
        suscripciones: await client.suscripcion.count({ where: { usuarioId: usuario.id } }),
        usuario: 1,
    };

    if (!opts.confirm) {
        log("borrar-padre", `DRY-RUN padre=${email} (${usuario.id})`);
        log("borrar-padre", `  · ContactoConfianza: ${conteoDetalle.contactos} (cascade IdentificadorContacto)`);
        log("borrar-padre", `  · Reporte: ${conteoDetalle.reportes} (con sus derivados)`);
        log("borrar-padre", `  · CodigoVerificacion: ${conteoDetalle.codigosVerificacion}`);
        log("borrar-padre", `  · TokenRecuperacion: ${conteoDetalle.tokensRecuperacion}`);
        log("borrar-padre", `  · Suscripcion: ${conteoDetalle.suscripciones}`);
        log("borrar-padre", "  · Usuario: 1");
        return { usuarioId: usuario.id, email, filasBorradas: 0, detalle: conteoDetalle, dryRun: true };
    }

    // Los reportes se borran uno a uno (fuera de la transacción del usuario
    // para reutilizar el orden FK-safe validado). Cada uno ya es transaccional.
    for (const id of reporteIds) {
        await borrarReporte(id, `${motivo} (padre ${email})`, { confirm: true, client });
    }

    return client.$transaction(async (tx) => {
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
            usuario: u ? 1 : 0,
        };
        const total = Object.values(detalle).reduce((a, b) => a + b, 0);

        await registrarAuditoria(tx, "padre", motivo, total, [usuario.id]);
        log("borrar-padre", `REALIZADO padre=${email} filas=${total}`);
        return { usuarioId: usuario.id, email, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
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
