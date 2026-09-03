/**
 * SPEC-380 (PR A · C4) — PUT/GET /api/colegio/comite/solicitudes/[id]/analisis.
 *
 * El comité de convivencia deja su análisis por escrito DURANTE la deliberación
 * (antes de cerrar el caso; separado de `SolicitudComite.resolucion` que se
 * llena solo al cerrar y ya la lee el informe del caso). El GET permite al
 * rector leer el análisis vigente sin poder editarlo.
 *
 * Voz: usted formal Colombia (brief §0). Cero orden, cero veredicto.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const analisisSchema = z.object({
    // 1..8000 caracteres: suficiente para una deliberación completa; el límite
    // superior es defensivo, no restrictivo — nadie escribe 8000 en la práctica.
    texto: z
        .string()
        .trim()
        .min(1, "Escriba el análisis del comité antes de guardar.")
        .max(8000, "El análisis no puede superar 8000 caracteres."),
});

async function resolverColegioId(user: {
    rol: string;
    id: string;
    colegioId?: string | null;
    comiteColegioId?: string | null;
}): Promise<string | null> {
    if (user.rol === "COMITE_CONVIVENCIA") return user.comiteColegioId ?? null;
    if (user.rol === "SCHOOL_ADMIN") return user.colegioId ?? null;
    return null;
}

/** GET · el rector y el comité pueden LEER el análisis del caso propio. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "COMITE_CONVIVENCIA" && user.rol !== "SCHOOL_ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        const colegioId = await resolverColegioId(user);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta sin colegio vinculado.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);
        const solicitud = await prisma.solicitudComite.findFirst({
            where: { id, colegioId },
            select: {
                analisis: true,
                analisisActualizadoEn: true,
                analisisPor: { select: { id: true, nombre: true, apellidos: true } },
                recomendacionInformeEn: true,
                recomendacionPor: { select: { id: true, nombre: true, apellidos: true } },
            },
        });
        if (!solicitud) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado.", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json(solicitud);
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/COMITE/ANALISIS/GET]");
    }
}

/** PUT · SOLO el comité edita el análisis. El rector lee, no escribe. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("COMITE_CONVIVENCIA");
        await assertModulo(user, "colegios_comite_bandeja");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (!user.comiteColegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta del comité no vinculada a un colegio.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);
        const body = await withValidation.body(analisisSchema)(request);

        const solicitud = await prisma.solicitudComite.findFirst({
            where: { id, colegioId: user.comiteColegioId },
            select: { id: true, estado: true },
        });
        if (!solicitud) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado.", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        // Cerrada = no se toca (el análisis ya quedó para el informe).
        if (solicitud.estado !== "PENDIENTE") {
            return NextResponse.json(
                { error: { message: "Este caso ya está resuelto — no se puede editar el análisis.", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizada = await prisma.solicitudComite.update({
            where: { id },
            data: {
                analisis: body.texto,
                analisisActualizadoEn: new Date(),
                analisisPorId: user.id,
            },
            select: {
                analisis: true,
                analisisActualizadoEn: true,
                analisisPor: { select: { id: true, nombre: true, apellidos: true } },
                recomendacionInformeEn: true,
                recomendacionPor: { select: { id: true, nombre: true, apellidos: true } },
            },
        });

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            accion: "COMITE_ANALISIS_ACTUALIZADO",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.comiteColegioId,
            valorNuevo: JSON.stringify({ longitud: body.texto.length }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json(actualizada);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[COLEGIO/COMITE/ANALISIS/PUT]");
    }
}
