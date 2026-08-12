import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { cuidIdSchema } from "@/lib/schemas";
import { ComiteConvivenciaIntegrantesService } from "@/lib/dal/services/comite-convivencia-integrantes";
import type { InfoClienteDto } from "@/lib/dal/types/comite-convivencia";

const updateSchema = z
    .object({
        nombres: z.string().trim().min(1).max(100).optional(),
        apellidos: z.string().trim().min(1).max(100).optional(),
        tipoIdentificacion: z.enum(["CEDULA_CIUDADANIA", "CEDULA_EXTRANJERIA", "PASAPORTE", "OTRO"]).optional(),
        numeroIdentificacion: z.string().trim().min(1).max(100).optional(),
        email: z.string().email().max(255).optional(),
        cargo: z.string().trim().min(1).max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo", path: ["root"] });

function getClientInfo(request: Request): InfoClienteDto {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_comite");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
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

        const { id } = z.object({ id: cuidIdSchema }).parse(await params);
        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed.data)) {
            if (value !== undefined) {
                payload[key] = value;
            }
        }

        const integrante = await new ComiteConvivenciaIntegrantesService().actualizar(
            user.colegioId,
            id,
            payload as import("@/lib/dal/services/comite-convivencia-integrantes").ActualizarIntegranteInput,
            user.id,
            getClientInfo(request)
        );

        return NextResponse.json({ integrante });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[COLEGIO/COMITE/INTEGRANTES/[ID]]");
    }
}
