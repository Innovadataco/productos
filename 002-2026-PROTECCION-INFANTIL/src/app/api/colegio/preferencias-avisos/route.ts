import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation, ValidationError } from "@/lib/validation";
import { preferenciaAvisoBodySchema } from "@/lib/schemas";
import {
    obtenerPreferenciaEfectiva,
    resolverEmailDestino,
} from "@/lib/colegio/avisos";
import {
    PreferenciaAlertaColegioRepository,
    TIPOS_EVENTO_AVISO,
} from "@/lib/dal/repositories/preferencia-alerta-colegio";

/**
 * SPEC-149 (FR-007) — Preferencias de avisos del colegio (tenant-first E-1:
 * el colegio sale de la sesión, nunca del cliente). GET devuelve los 4 tipos
 * con sus valores EFECTIVOS (fila propia o defaults de la spec); PATCH hace
 * upsert por tipo y audita COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA.
 */

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function verificarAccesoColegio(request: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_gestion");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, scope, { identifier: user.id });
    if (!rate.allowed) {
        return {
            error: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    if (!user.colegioId) {
        return { error: NextResponse.json({ error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    return { user, colegioId: user.colegioId };
}

async function itemEfectivo(colegioId: string, tipoEvento: (typeof TIPOS_EVENTO_AVISO)[number], emailPorDefecto: string | null) {
    const efectiva = await obtenerPreferenciaEfectiva(colegioId, tipoEvento);
    return {
        tipoEvento,
        habilitado: efectiva.habilitado,
        emailDestino: efectiva.emailDestino,
        emailEfectivo: efectiva.emailDestino ?? emailPorDefecto,
        umbral: efectiva.umbral || null,
        ventanaDias: efectiva.ventanaDias || null,
    };
}

export async function GET(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_read");
        if ("error" in acceso) return acceso.error;

        const emailPorDefecto = await resolverEmailDestino(acceso.colegioId, null);
        const items = await Promise.all(TIPOS_EVENTO_AVISO.map((tipo) => itemEfectivo(acceso.colegioId, tipo, emailPorDefecto)));

        return NextResponse.json({ items, emailPorDefecto });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PREFERENCIAS-AVISOS]");
    }
}

export async function PATCH(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const body = await withValidation.body(preferenciaAvisoBodySchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });

        const repo = new PreferenciaAlertaColegioRepository();
        const anterior = await repo.obtenerPorTipo(acceso.colegioId, body.tipoEvento);

        const actualizada = await repo.upsertPreferencia(acceso.colegioId, body.tipoEvento, {
            ...(body.habilitado !== undefined ? { habilitado: body.habilitado } : {}),
            ...(body.emailDestino !== undefined ? { emailDestino: body.emailDestino } : {}),
            ...(body.umbral !== undefined ? { umbral: body.umbral } : {}),
            ...(body.ventanaDias !== undefined ? { ventanaDias: body.ventanaDias } : {}),
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA",
            tipoRecurso: "PreferenciaAlertaColegio",
            recursoId: actualizada.id,
            usuarioId: acceso.user.id,
            colegioId: acceso.colegioId,
            valorAnterior: anterior
                ? JSON.stringify({
                    habilitado: anterior.habilitado,
                    emailDestino: anterior.emailDestino,
                    umbral: anterior.umbral,
                    ventanaDias: anterior.ventanaDias,
                })
                : undefined,
            valorNuevo: JSON.stringify({
                tipoEvento: body.tipoEvento,
                habilitado: actualizada.habilitado,
                emailDestino: actualizada.emailDestino,
                umbral: actualizada.umbral,
                ventanaDias: actualizada.ventanaDias,
            }),
            ipAddress,
            userAgent,
        });

        const emailPorDefecto = await resolverEmailDestino(acceso.colegioId, null);
        const item = await itemEfectivo(acceso.colegioId, body.tipoEvento, emailPorDefecto);
        return NextResponse.json({ item });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PREFERENCIAS-AVISOS]");
    }
}
