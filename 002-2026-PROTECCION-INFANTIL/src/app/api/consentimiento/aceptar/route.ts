/**
 * SPEC-241 (002-PI-144): POST /api/consentimiento/aceptar
 * Registra la aceptación del consentimiento informado con hash SHA256 del
 * documento legal vigente y traza inmutable en AuditConsentimiento.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { consentimientoAceptarSchema } from "@/lib/validators";
import { ConsentimientoService } from "@/lib/dal/services/consentimiento";
import { logAudit } from "@/lib/audit";

function obtenerIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() ?? "unknown";
    }
    return "unknown";
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = consentimientoAceptarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { documentoTipo, esRepresentanteLegal } = parsed.data;
        const ip = obtenerIp(request);
        const userAgent = request.headers.get("user-agent");

        const servicio = new ConsentimientoService();

        // Idempotencia segura: si ya aceptó la versión vigente, no duplicamos.
        const estaActual = await servicio.versionEstaActual(user.id);
        if (estaActual) {
            return NextResponse.json({ ok: true, version: await servicio.versionVigente() }, { status: 200 });
        }

        const resultado = await servicio.aceptar({
            usuarioId: user.id,
            rol: user.rol,
            documentoTipo,
            esRepresentanteLegal,
            ip,
            userAgent,
        });

        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: user.id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({
                consentimientoVersion: resultado.version,
                documentoTipo,
                documentoHash: resultado.usuario.consentimientoDocumentoHash,
            }),
            ipAddress: ip,
            userAgent: userAgent ?? "",
            metadatos: { evento: "consentimiento.aceptado", version: resultado.version },
        });

        return NextResponse.json(
            {
                ok: true,
                version: resultado.version,
                usuario: {
                    id: resultado.usuario.id,
                    consentimientoVersion: resultado.usuario.consentimientoVersion,
                    consentimientoAceptadoEn: resultado.usuario.consentimientoAceptadoEn,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[Consentimiento API] Error en aceptar:", error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
