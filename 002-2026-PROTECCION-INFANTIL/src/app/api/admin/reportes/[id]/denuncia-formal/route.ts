import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { cargarDatosExpediente } from "@/lib/expediente/expediente";
import { cargarCanalesPadre } from "@/lib/expediente/mensaje-padre";
import { generarPdfDenuncia } from "@/lib/expediente/pdf-denuncia";
import { extraerConductas } from "@/lib/expediente/expediente-forense";
import { logAuditNuevaAccion, ACCION_DENUNCIA_FORMAL_GENERADA } from "@/lib/audit-nuevas-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/admin/reportes/[id]/denuncia-formal (SPEC-140, F2, FR-001…FR-005).
 * Genera y DESCARGA el PDF de denuncia formal por PLANTILLA DETERMINISTA por
 * conducta (D-23, nunca IA), dirigido a un canal oficial elegido. La plataforma
 * NO retiene el documento (FR-003): el Buffer vive solo en esta respuesta.
 * Registra el evento en AuditLog SIN contenido (FR-004/D-22).
 * Solo reportes con clasificación (CLASIFICADO, CORREGIDO, REVISION_MANUAL);
 * PENDIENTE/PROCESANDO/POSIBLE_SPAM/DUPLICADO/sin clasificación → 409;
 * eliminado o inexistente → 404.
 */

const ESTADOS_CON_CLASIFICACION = new Set(["CLASIFICADO", "CORREGIDO", "REVISION_MANUAL"]);

const bodySchema = z.object({
    canalDestino: z.string().min(1).max(200),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "denuncia_formal");

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
        const reporteId = parsedId.data;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: { message: "Cuerpo JSON inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const parsedBody = bodySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos: se requiere canalDestino", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const datos = await cargarDatosExpediente(reporteId);
        if (!datos || datos.reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const r = datos.reporte;

        if (!ESTADOS_CON_CLASIFICACION.has(r.estado) || !r.clasificacion) {
            return NextResponse.json(
                {
                    error: {
                        message: "El reporte aún no tiene una clasificación confirmada",
                        code: ERROR_CODES.CONFLICT,
                    },
                },
                { status: 409 }
            );
        }

        // El canal debe ser uno de los canales oficiales del parámetro
        // `mensaje.padre.canales` (FR-005; editables sin desplegar).
        const canales = await cargarCanalesPadre();
        const canal = canales.find((c) => c.nombre === parsedBody.data.canalDestino);
        if (!canal) {
            return NextResponse.json(
                {
                    error: {
                        message: "Canal destino inválido: debe ser uno de los canales oficiales configurados",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 }
            );
        }

        const pdfBuffer = await generarPdfDenuncia({
            canalDestino: canal,
            canales,
            identificador: r.identificador,
            plataforma: r.plataforma.nombre,
            fechaIncidente: r.fechaIncidente,
            ciudad: r.ciudad,
            pais: r.pais,
            conductas: extraerConductas(r.clasificacion),
            numeroSeguimiento: r.numeroSeguimiento,
            fechaGeneracion: new Date(),
        });

        // D-22: el evento registra SOLO metadatos — nunca el documento ni el
        // texto del reporte (la IP se persiste hasheada por el helper).
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAuditNuevaAccion({
            accion: ACCION_DENUNCIA_FORMAL_GENERADA,
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            ipAddress,
            userAgent,
            metadatos: {
                reporteId,
                canalDestino: canal.nombre,
                usuarioId: user.id,
                fecha: new Date().toISOString(),
            },
        });

        const nombreArchivo = `denuncia-formal-${r.numeroSeguimiento ?? reporteId}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[DenunciaFormal] Error generando denuncia formal", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
