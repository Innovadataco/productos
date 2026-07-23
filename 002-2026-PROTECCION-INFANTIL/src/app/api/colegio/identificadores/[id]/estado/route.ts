import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorAlumnoIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadIdentificador } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
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

        const { id } = withValidation.params(identificadorAlumnoIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);

        const identificador = await verificarPropiedadIdentificador(user.id, id);
        if (identificador.estado === body) {
            return NextResponse.json(
                { error: { message: `El identificador ya está ${body}`, code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizado = await prisma.identificadorAlumno.update({
            where: { id },
            data: { estado: body },
            include: { plataforma: { select: { id: true, clave: true, nombre: true } } },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_DESACTIVADO",
            tipoRecurso: "IdentificadorAlumno",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: identificador.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && error.message === "Identificador no encontrado") {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
