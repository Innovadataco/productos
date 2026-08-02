import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
    calcularPlazoRespuesta,
    contarReportesAsociados,
    generarNumeroApelacion,
    getMaxTamanoDocumentoMb,
} from "@/lib/apelaciones";
import {
    ApelacionStorageError,
    eliminarDocumentoCifrado,
    guardarDocumentoCifrado,
    sha256Hex,
    validarPdf,
} from "@/lib/apelacion-storage";
import { ApelacionService } from "@/lib/dal/services/apelaciones";

/**
 * SPEC-110 — Radicación de apelaciones por el titular (o representante acreditado).
 *
 * Reglas duras:
 * - Sin cuenta no hay apelación (401).
 * - Apelar NO cambia la visibilidad del identificador (solo la resolución del comité).
 * - La evidencia (PDF sobre sí mismo) se cifra en reposo y solo la ve el comité.
 */

const camposSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataformaId: idSchema,
    motivo: z.string().min(10).max(4000),
    esRepresentante: z.enum(["true", "false"]).default("false"),
    acreditacion: z.string().max(4000).optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();

        const rate = await checkRateLimit(request, "apelacion", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        let form: FormData;
        try {
            form = await request.formData();
        } catch {
            return NextResponse.json(
                { error: { message: "La solicitud debe ser multipart/form-data", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const parsed = camposSchema.safeParse({
            identificador: form.get("identificador"),
            plataformaId: form.get("plataformaId"),
            motivo: form.get("motivo"),
            esRepresentante: form.get("esRepresentante") ?? "false",
            acreditacion: form.get("acreditacion") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { identificador, plataformaId, motivo, esRepresentante, acreditacion } = parsed.data;
        const esRep = esRepresentante === "true";
        if (esRep && !acreditacion?.trim()) {
            return NextResponse.json(
                { error: { message: "Debes describir la acreditación de representación", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const archivo = form.get("documento");
        // Chequeo estructural (no `instanceof File`): undici y jsdom producen Files de
        // realms distintos; lo que importa es que sea un archivo con contenido leíble.
        const esArchivo =
            archivo !== null &&
            typeof archivo === "object" &&
            typeof (archivo as File).arrayBuffer === "function" &&
            typeof (archivo as File).type === "string";
        if (!esArchivo) {
            return NextResponse.json(
                { error: { message: "Debes adjuntar el documento de evidencia (PDF)", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const archivoFile = archivo as File;
        const buffer = Buffer.from(await archivoFile.arrayBuffer());

        const validacion = validarPdf(buffer, archivoFile.type);
        if (!validacion.ok) {
            return NextResponse.json(
                { error: { message: validacion.motivo ?? "El documento debe ser un PDF válido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const maxMb = await getMaxTamanoDocumentoMb();
        if (buffer.length > maxMb * 1024 * 1024) {
            return NextResponse.json(
                { error: { message: `El documento supera el tamaño máximo de ${maxMb} MB`, code: "PAYLOAD_TOO_LARGE" } },
                { status: 413 }
            );
        }

        // SPEC-053: plataforma y apelación abierta se verifican en el DAL; la ruta no toca prisma.
        const apelacionService = new ApelacionService();
        const preparacion = await apelacionService.prepararRadicacion({
            usuarioId: user.id,
            identificador,
            plataformaId,
        });

        if (!preparacion.ok) {
            if (preparacion.tipo === "plataforma_invalida") {
                return NextResponse.json(
                    { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
            if (preparacion.tipo === "sin_reportes") {
                // N-3 (002-PI-056): anti-spam — no se apela un identificador sin reportes.
                return NextResponse.json(
                    { error: { message: "No hay reportes registrados para este identificador", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
            return NextResponse.json(
                { error: { message: "Ya tienes una apelación abierta para este identificador", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Cifrar y persistir la evidencia ANTES de crear las filas (fail-closed si no
        // hay clave: nunca se guarda evidencia en claro). Si la BD falla, se compensa
        // borrando el archivo.
        const documentoId = crypto.randomUUID();
        let rutaArchivo: string;
        try {
            rutaArchivo = await guardarDocumentoCifrado(documentoId, buffer);
        } catch (err) {
            if (err instanceof ApelacionStorageError && err.code === "CLAVE_NO_CONFIGURADA") {
                logger.error("[Apelaciones] Creación: fallida — clave de cifrado no configurada");
                return NextResponse.json(
                    { error: { message: "Servicio no disponible", code: ERROR_CODES.SERVICE_UNAVAILABLE } },
                    { status: 503 }
                );
            }
            throw err;
        }

        const ahora = new Date();
        const plazoRespuestaEn = await calcularPlazoRespuesta(ahora);
        const hash = sha256Hex(buffer);

        let apelacion;
        try {
            apelacion = await apelacionService.radicar({
                numero: generarNumeroApelacion(),
                usuarioId: user.id,
                identificador,
                plataformaId,
                motivo,
                esRepresentante: esRep,
                acreditacion: esRep && acreditacion ? acreditacion.trim() : null,
                estado: "RECIBIDA",
                plazoRespuestaEn,
                documentos: {
                    create: {
                        id: documentoId,
                        nombreOriginal: (archivoFile.name || "evidencia.pdf").slice(0, 255),
                        rutaArchivo,
                        hashSha256: hash,
                        tamanoBytes: buffer.length,
                        mimeType: "application/pdf",
                    },
                },
            });
        } catch (err) {
            await eliminarDocumentoCifrado(rutaArchivo);
            // Carrera sobre el índice único parcial de apelación abierta.
            if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
                return NextResponse.json(
                    { error: { message: "Ya tienes una apelación abierta para este identificador", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
            throw err;
        }

        const numeroReportesAsociados = await contarReportesAsociados(identificador, plataformaId);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "APELACION_CREADA",
            tipoRecurso: "Apelacion",
            recursoId: apelacion.id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({
                numero: apelacion.numero,
                estado: "RECIBIDA",
                esRepresentante: esRep,
                plazoRespuestaEn,
                documento: { id: documentoId, tamanoBytes: buffer.length, hashSha256: hash },
            }),
            ipAddress,
            userAgent,
        });

        logger.info(`[Apelaciones] Creación: exitosa — numero=${apelacion.numero}, usuario=${user.id}`);

        return NextResponse.json(
            {
                apelacion: {
                    id: apelacion.id,
                    numero: apelacion.numero,
                    estado: apelacion.estado,
                    plazoRespuestaEn: apelacion.plazoRespuestaEn,
                    creadoEn: apelacion.creadoEn,
                    numeroReportesAsociados,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[Apelaciones] Error en creación:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
