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
import { esTitularDelDato } from "@/lib/routing/roles-titulares";
import { logAudit } from "@/lib/audit";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";

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

        // SPEC-756: la puerta de consentimiento es SOLO para titulares del dato
        // (misma fuente única que el emisor de sesión y la página). Un rol interno
        // /prestador no firma este consentimiento — 403 ANTES de tocar la lógica,
        // para no fabricar la firma que el auditor (SPEC-755) marca como inválida.
        // Cerrar la pantalla no cierra el endpoint: la decisión vive en las dos
        // superficies leyendo la MISMA fuente.
        if (!esTitularDelDato(user.rol)) {
            throw new AppError(
                "El consentimiento informado es solo para titulares del dato.",
                ERROR_CODES.FORBIDDEN,
                403,
            );
        }

        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = consentimientoAceptarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-756: `esRepresentanteLegal` SÍ viene del cuerpo — es una DECLARACIÓN
        // del usuario que el servidor no puede verificar; derivarla destruiría su
        // valor probatorio. `documentoTipo` NO: el servidor SABE qué documento le
        // toca al rol, así que lo DERIVA e IGNORA lo que venga en el cuerpo (gate
        // condicionado a un valor del cliente).
        const { esRepresentanteLegal } = parsed.data;
        const ip = obtenerIp(request);
        const userAgent = request.headers.get("user-agent");

        const servicio = new ConsentimientoService();
        const documentoTipo = servicio.documentoPorRol(user.rol);

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

        const res = NextResponse.json(
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
        try {
            const cookieValue = await buildSesionEstadoValue(user.id);
            res.cookies.set(NOMBRE_COOKIE, cookieValue, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.COOKIE_SECURE !== "false",
                maxAge: TTL_SEG,
                path: "/",
            });
        } catch {
            // fallo silencioso — la cookie de estado no bloquea el registro de consentimiento
        }
        return res;
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
