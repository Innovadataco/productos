import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { ResponsableTransicion } from "@prisma/client";
import { z } from "zod";

const responsableTransicionValues = Object.values(ResponsableTransicion) as [string, ...string[]];

const querySchema = z.object({
    responsableTipo: z.enum(responsableTransicionValues).optional(),
});

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

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            select: { id: true, estado: true, operadorId: true, tenantId: true, eliminado: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (!puedeGestionarReporte(user, reporte)) {
            return NextResponse.json(
                { error: { message: "No tenés permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const parsedQuery = querySchema.safeParse({
            responsableTipo: searchParams.get("responsableTipo") ?? undefined,
        });
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Filtro inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const transiciones = await prisma.transicionReporte.findMany({
            where: {
                reporteId: id,
                ...(parsedQuery.data.responsableTipo
                    ? { responsableTipo: parsedQuery.data.responsableTipo as ResponsableTransicion }
                    : {}),
            },
            orderBy: { creadoEn: "asc" },
            include: {
                responsableUsuario: {
                    select: { id: true, email: true, nombre: true, rol: true },
                },
            },
        });

        return NextResponse.json({ transiciones });
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
