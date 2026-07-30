import { NextResponse } from "next/server";
import { CategoriaConducta, RolUsuario } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { IaRubricaService } from "@/lib/dal/services/ia-rubrica";
import { AppError, ERROR_CODES } from "@/lib/errors";

const preguntasBodySchema = z.object({
    categoria: z.enum(CategoriaConducta),
    preguntas: z
        .array(
            z.object({
                texto: z.string().min(10, "Cada pregunta debe tener al menos 10 caracteres").max(300, "Máximo 300 caracteres por pregunta"),
                activo: z.boolean(),
            })
        )
        .min(1, "El set debe tener al menos 1 pregunta")
        .max(10, "Máximo 10 preguntas por categoría"),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PUT /api/admin/ia/rubrica/preguntas — reemplaza el set de preguntas de UNA
 * categoría dentro del JSON `ia.rubrica.preguntas` (lee-modifica-escribe).
 */
export async function PUT(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const body = await request.json();
        const parsed = preguntasBodySchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const { categoria, preguntas } = parsed.data;

        // SPEC-053: lee-modifica-escribe del JSON, auditoría e invalidación de
        // caché viven en el DAL.
        await new IaRubricaService().actualizarPreguntas(categoria, preguntas, user.id, getClientInfo(request));

        return NextResponse.json({ categoria, preguntas });
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
