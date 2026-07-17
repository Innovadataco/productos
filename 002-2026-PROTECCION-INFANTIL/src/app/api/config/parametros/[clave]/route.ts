import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/config-cache";
import { isLocalOllamaUrl } from "@/lib/ai/ollama-config";
import { AppError, ERROR_CODES } from "@/lib/errors";

type RouteContext = { params: Promise<{ clave: string }> };

export async function GET(_request: Request, context: RouteContext) {
    try {
        await verifyAuth("ADMIN" as never);
        const { clave } = await context.params;

        const param = await prisma.parametroSistema.findUnique({
            where: { clave },
            include: {
                auditLogs: {
                    where: { accion: "PARAM_UPDATE" },
                    orderBy: { creadoEn: "desc" },
                    take: 10,
                    include: { usuario: { select: { email: true } } },
                },
            },
        });

        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        return NextResponse.json({
            ...param,
            historial: param.auditLogs.map((a: { valorAnterior: string | null; valorNuevo: string | null; usuario: { email: string | null } | null; creadoEn: Date }) => ({
                valorAnterior: a.valorAnterior,
                valorNuevo: a.valorNuevo,
                actualizadoPor: a.usuario?.email,
                actualizadoEn: a.creadoEn,
            })),
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

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth("ADMIN" as never);
        const { clave } = await context.params;

        const param = await prisma.parametroSistema.findUnique({
            where: { clave },
        });
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const body = (await request.json()) as { valor: string; motivo?: string };
        if (!body.valor) {
            throw new AppError("Valor requerido", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        // Validación R2: URL de Ollama solo local/privada
        if (clave === "system.ollama_base_url" && !isLocalOllamaUrl(body.valor)) {
            throw new AppError(
                "los textos de reportes solo pueden procesarse en entorno local/privado (R2)",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const updated = await prisma.parametroSistema.update({
            where: { clave },
            data: { valor: body.valor, actualizadoPorId: user.id },
        });

        await logAudit({
            accion: "PARAM_UPDATE",
            tipoRecurso: "parametro",
            recursoId: param.id,
            parametroId: param.id,
            usuarioId: user.id,
            valorAnterior: param.valor,
            valorNuevo: body.valor,
            metadatos: { motivo: body.motivo },
        });

        invalidateCache("public_params");
        return NextResponse.json(updated);
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

export async function DELETE(_request: Request, context: RouteContext) {
    try {
        await verifyAuth("ADMIN" as never);
        const { clave } = await context.params;

        const param = await prisma.parametroSistema.findUnique({
            where: { clave },
        });
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        if (param.categoria === "SYSTEM" || param.clave.startsWith("security.")) {
            throw new AppError(
                "Parámetro crítico no puede eliminarse",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        await prisma.parametroSistema.delete({ where: { clave } });
        invalidateCache("public_params");

        return new NextResponse(null, { status: 204 });
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