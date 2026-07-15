import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

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

        const plataforma = await prisma.plataforma.findUnique({
            where: { id: plataformaId },
        });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // El identificador debe existir y ser visible públicamente para suscribirse.
        const identificadorReportado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
        if (!identificadorReportado || !identificadorReportado.esVisiblePublicamente) {
            return NextResponse.json(
                { error: { message: "El identificador no está disponible públicamente para alertas", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const suscripcion = await prisma.alertaSuscripcion.upsert({
            where: {
                usuarioId_identificador_plataformaId: {
                    usuarioId: user.id,
                    identificador,
                    plataformaId,
                },
            },
            update: { activa: true },
            create: {
                usuarioId: user.id,
                identificador,
                plataformaId,
                activa: true,
            },
            include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
        });

        return NextResponse.json({ suscripcion }, { status: 201 });
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
