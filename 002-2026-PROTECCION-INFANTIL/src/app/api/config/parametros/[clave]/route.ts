import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { logAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/config-cache";
import { isLocalOllamaUrl } from "@/lib/ai/ollama-config";
import { encryptParameter } from "@/lib/param-encryption";
import { GRUPOS_CATEGORIA_FALLBACK } from "@/lib/categoria-grupos";
import { withValidation } from "@/lib/validation";
import { parametroClaveParamsSchema, parametroPatchBodySchema } from "@/lib/schemas";
import { AppError, ERROR_CODES } from "@/lib/errors";

type RouteContext = { params: Promise<{ clave: string }> };

const PARAM_CREATE_DEFAULTS: Record<
    string,
    {
        valor: string;
        tipo: "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "JSON" | "STRING_ARRAY";
        categoria: "VISIBILITY" | "SECURITY" | "LEGAL" | "EMAIL" | "SYSTEM";
        esPublico?: boolean;
        esSecreto?: boolean;
        descripcion?: string;
    }
> = {
    "ui.grupos_categoria": {
        valor: JSON.stringify({ grupos: GRUPOS_CATEGORIA_FALLBACK }),
        tipo: "JSON",
        categoria: "SYSTEM",
        esPublico: true,
        esSecreto: false,
        descripcion: "Grupos de presentación de categorías de conducta para el usuario final",
    },
};

export async function GET(_request: Request, context: RouteContext) {
    try {
        await assertModulo(await verifyAuth("ADMIN" as never), "configuracion_sistema");
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
            valor: param.esSecreto ? null : param.valor,
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
        await assertModulo(user, "configuracion_sistema");
        const { clave } = withValidation.params(parametroClaveParamsSchema)(await context.params);
        const body = await withValidation.body(parametroPatchBodySchema)(request);

        // Validación R2: URL de Ollama solo local/privada
        if (clave === "system.ollama_base_url" && !isLocalOllamaUrl(body.valor)) {
            throw new AppError(
                "los textos de reportes solo pueden procesarse en entorno local/privado (R2)",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const existing = await prisma.parametroSistema.findUnique({
            where: { clave },
        });
        const isNew = !existing;

        const defaults = isNew ? PARAM_CREATE_DEFAULTS[clave] : undefined;
        if (isNew && !defaults && !body.tipo) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const esSecreto = existing?.esSecreto ?? body.esSecreto ?? defaults?.esSecreto ?? false;
        const valorParaGuardar = esSecreto ? encryptParameter(body.valor) : body.valor;

        let param;
        if (isNew) {
            const tipo = body.tipo ?? defaults!.tipo;
            const categoria = body.categoria ?? defaults!.categoria;
            param = await prisma.parametroSistema.create({
                data: {
                    clave,
                    valor: valorParaGuardar,
                    tipo,
                    categoria,
                    esPublico: body.esPublico ?? defaults?.esPublico ?? false,
                    esSecreto,
                    descripcion: body.descripcion ?? defaults?.descripcion ?? undefined,
                    actualizadoPorId: user.id,
                },
            });
        } else {
            param = await prisma.parametroSistema.update({
                where: { clave },
                data: { valor: valorParaGuardar, actualizadoPorId: user.id },
            });
        }

        await logAudit({
            accion: "PARAM_UPDATE",
            tipoRecurso: "parametro",
            recursoId: param.id,
            parametroId: param.id,
            usuarioId: user.id,
            valorAnterior: isNew ? undefined : existing!.valor,
            valorNuevo: valorParaGuardar,
            metadatos: { motivo: body.motivo, esSecreto, nuevo: isNew },
        });

        invalidateCache("public_params");
        return NextResponse.json({
            ...param,
            valor: param.esSecreto ? null : param.valor,
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

export async function DELETE(_request: Request, context: RouteContext) {
    try {
        await assertModulo(await verifyAuth("ADMIN" as never), "configuracion_sistema");
        const { clave } = withValidation.params(parametroClaveParamsSchema)(await context.params);

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
