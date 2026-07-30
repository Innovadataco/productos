import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { AlertaService } from "@/lib/dal/services/alertas";

const suscribirSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataformaId: z.string().min(1),
});

/**
 * POST /api/alertas/suscribir
 * Crea o reactiva una suscripción de alerta por email para un identificador público.
 */
export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const body = await request.json();
        const parsed = suscribirSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { identificador, plataformaId } = parsed.data;

        // SPEC-053: plataforma, visibilidad pública y upsert viven en el DAL; la ruta no toca prisma.
        const resultado = await new AlertaService().suscribir({ usuarioId: user.id, identificador, plataformaId });

        if (!resultado.ok) {
            if (resultado.tipo === "plataforma_invalida") {
                return NextResponse.json(
                    { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: { message: "El identificador no está disponible públicamente para alertas", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({ suscripcion: resultado.suscripcion }, { status: 201 });
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
