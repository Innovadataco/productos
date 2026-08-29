import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { IaRubricaService } from "@/lib/dal/services/ia-rubrica";
import { AppError, ERROR_CODES } from "@/lib/errors";

const configBodySchema = z
    .object({
        modelos: z.array(z.string().min(1)).min(1, "Debe haber al menos 1 modelo").max(5, "Máximo 5 modelos").optional(),
        temperatura: z.number().min(0, "La temperatura mínima es 0").max(2, "La temperatura máxima es 2").optional(),
        umbralPresencia: z.number().min(0, "El umbral mínimo es 0").max(1, "El umbral máximo es 1").optional(),
        modeloEmbudo: z.string().min(1, "El modelo de embudo no puede estar vacío").max(100).optional(),
    })
    .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
        message: "Debe enviar al menos un parámetro a actualizar",
    });

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PATCH /api/admin/ia/rubrica/config — actualiza parámetros operativos de la
 * rúbrica (modelos, temperatura, umbral de presencia, modelo de embudo).
 */
export async function PATCH(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const body = await request.json();
        const parsed = configBodySchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        // SPEC-053: upsert por parámetro, auditoría e invalidación de caché
        // viven en el DAL.
        const { actualizados } = await new IaRubricaService().actualizarConfig(
            parsed.data,
            user.id,
            getClientInfo(request)
        );

        return NextResponse.json({ actualizados });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
