import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esComiteRol } from "@/lib/operadores/permisos";
import { logAudit } from "@/lib/audit";
import { ApelacionStorageError, leerDocumentoDescifrado, sha256Hex } from "@/lib/apelacion-storage";

/**
 * SPEC-110 — Descarga de la evidencia documental (SOLO el comité de validación).
 *
 * Enmienda constitucional: la evidencia es prueba de identidad subida por el titular
 * sobre sí mismo; la ve ÚNICAMENTE el comité de validación. ADMIN, OPERADOR, PARENT y
 * cualquier otro rol reciben 403. El endpoint descifra en memoria y streamea el PDF;
 * nunca expone una URL pública. Cada acceso registra AuditLog (APELACION_DOCUMENTO_ACCESO)
 * y una fila AccesoDocumentoApelacion (quién, cuándo, IP, user-agent).
 * Documento purgado o ausente en disco → 410.
 */

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        // Regla dura: SOLO el comité de validación descarga evidencia (ni ADMIN).
        if (!esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "La evidencia solo está disponible para el comité de validación", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const apelacion = await prisma.apelacion.findUnique({
            where: { id },
            select: { id: true, numero: true, documentos: true },
        });
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const documento = apelacion.documentos[0] ?? null;
        if (!documento) {
            return NextResponse.json(
                { error: { message: "La apelación no tiene documento", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (documento.eliminadoEn) {
            return NextResponse.json(
                { error: { message: "El documento fue purgado por retención", code: "GONE" } },
                { status: 410 }
            );
        }

        let pdf: Buffer;
        try {
            pdf = await leerDocumentoDescifrado(documento.rutaArchivo);
        } catch (err) {
            if (err instanceof ApelacionStorageError && err.code === "ARCHIVO_NO_ENCONTRADO") {
                console.error(`[ComiteApelaciones] Anomalía: documento ${documento.id} sin archivo en disco (apelacion=${apelacion.numero})`);
                return NextResponse.json(
                    { error: { message: "El documento ya no está disponible", code: "GONE" } },
                    { status: 410 }
                );
            }
            throw err;
        }

        // Integridad: el PDF descifrado debe coincidir con el hash registrado al subirlo.
        if (sha256Hex(pdf) !== documento.hashSha256) {
            console.error(`[ComiteApelaciones] Integridad inválida en documento ${documento.id} (apelacion=${apelacion.numero})`);
            return NextResponse.json(
                { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await prisma.accesoDocumentoApelacion.create({
            data: { documentoId: documento.id, usuarioId: user.id, ipAddress, userAgent },
        });
        await logAudit({
            accion: "APELACION_DOCUMENTO_ACCESO",
            tipoRecurso: "DocumentoApelacion",
            recursoId: documento.id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ apelacionId: apelacion.id, numero: apelacion.numero }),
            ipAddress,
            userAgent,
        });

        return new Response(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="evidencia-${apelacion.numero}.pdf"`,
                "Content-Length": String(pdf.length),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[ComiteApelaciones] Error descargando evidencia:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
