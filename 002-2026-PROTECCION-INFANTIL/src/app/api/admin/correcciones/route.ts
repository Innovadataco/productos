import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

type CategoriaConducta =
    | "CONTACTO_INSISTENTE"
    | "SOLICITUD_MATERIAL"
    | "OFRECIMIENTO_REGALOS"
    | "SUPLANTACION_IDENTIDAD"
    | "SOLICITUD_ENCUENTRO"
    | "COMPARTIMIENTO_SEXUAL"
    | "OTRO";

const correccionSchema = z.object({
    reporteId: z.string().min(1),
    categoriaCorregida: z.enum([
        "CONTACTO_INSISTENTE",
        "SOLICITUD_MATERIAL",
        "OFRECIMIENTO_REGALOS",
        "SUPLANTACION_IDENTIDAD",
        "SOLICITUD_ENCUENTRO",
        "COMPARTIMIENTO_SEXUAL",
        "OTRO",
    ]),
    comentario: z.string().max(2000).optional(),
});

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        requireAdmin(user);

        const body = await request.json();
        const parsed = correccionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { reporteId, categoriaCorregida, comentario } = parsed.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            include: { clasificacion: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const categoriaAnterior = reporte.clasificacion?.categoria || "OTRO";

        // Guardar corrección usando Prisma ORM
        const correccion = await prisma.correccionAdmin.create({
            data: {
                clasificacionId: reporte.clasificacion!.id,
                categoriaOriginal: categoriaAnterior,
                categoriaCorregida: categoriaCorregida,
                adminId: user.id,
                motivo: comentario || null,
            },
        });

        // Actualizar clasificación con la corrección
        if (reporte.clasificacion) {
            await prisma.clasificacionIA.update({
                where: { reporteId },
                data: {
                    categoria: categoriaCorregida,
                    confianza: 1.0,
                },
            });
        }

        // Actualizar estado del reporte
        await prisma.reporte.update({
            where: { id: reporteId },
            data: { estado: "CORREGIDO" },
        });

        // Guardar en dataset de entrenamiento
        await prisma.datasetEntrenamiento.create({
            data: {
                texto: reporte.texto,
                clasificacionCorrecta: categoriaCorregida,
                fuente: "correccion_admin",
                correccionId: correccion.id,
            },
        });

        return NextResponse.json({
            reporteId,
            categoriaAnterior,
            categoriaCorregida,
            estado: "CORREGIDO",
        });
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