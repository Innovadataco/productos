import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ numero: string }> }
) {
    try {
        const { numero } = await params;

        const reporte = await prisma.reporte.findUnique({
            where: { numeroSeguimiento: numero },
            select: {
                numeroSeguimiento: true,
                estado: true,
                creadoEn: true,
            },
        });

        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Número de seguimiento no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const mensajes: Record<string, string> = {
            PENDIENTE: "Tu reporte está pendiente de procesamiento.",
            PROCESANDO: "Tu reporte está siendo procesado.",
            CLASIFICADO: "Tu reporte ha sido procesado y clasificado.",
            REVISION_MANUAL: "Tu reporte requiere revisión manual.",
            POSIBLE_SPAM: "Tu reporte está siendo revisado.",
            DUPLICADO: "Tu reporte fue vinculado a uno existente.",
            REQUIERE_ANONIMIZACION: "Tu reporte está en revisión de privacidad.",
            CORREGIDO: "Tu reporte ha sido revisado y corregido.",
        };

        return NextResponse.json({
            numeroSeguimiento: reporte.numeroSeguimiento,
            estado: reporte.estado,
            creadoEn: reporte.creadoEn,
            mensaje: mensajes[reporte.estado] || "Estado desconocido",
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}