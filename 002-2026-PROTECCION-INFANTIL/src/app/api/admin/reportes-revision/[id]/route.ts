import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const id = parsedId.data;

        const permisosReporte = await prisma.reporte.findUnique({
            where: { id },
            select: { operadorId: true, tenantId: true },
        });

        if (!permisosReporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (!puedeGestionarReporte(user, permisosReporte)) {
            return NextResponse.json(
                { error: { message: "No tenés permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            select: {
                id: true,
                identificador: true,
                numeroSeguimiento: true,
                estado: true,
                texto: true,
                esAnonimo: true,
                prioridadAlta: true,
                keywordsDetectadas: true,
                esRafaga: true,
                eliminado: true,
                motivoBaja: true,
                notaBaja: true,
                eliminadoEn: true,
                creadoEn: true,
                fechaIncidente: true,
                ciudad: true,
                pais: true,
                edadVictima: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                operador: { select: { id: true, email: true, nombre: true } },
                reintentos: { orderBy: { intento: "asc" } },
                clasificacion: {
                    include: {
                        correccion: {
                            select: {
                                categoriaOriginal: true,
                                categoriaCorregida: true,
                                motivo: true,
                                confirmada: true,
                                creadoEn: true,
                            },
                        },
                    },
                },
            },
        });

        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            reporte,
            puedeRevelarOriginal: user.rol === "ADMIN",
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
