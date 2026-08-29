import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { invalidateCache } from "@/lib/config-cache";
import { isLocalOllamaUrl } from "@/lib/ai/ollama-config";
import { withValidation } from "@/lib/validation";
import { parametroClaveParamsSchema, parametroPatchBodySchema } from "@/lib/schemas";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";

type RouteContext = { params: Promise<{ clave: string }> };

export async function GET(_request: Request, context: RouteContext) {
    try {
        await assertModulo(await verifyAuth("ADMIN" as never), "configuracion_sistema");
        const { clave } = await context.params;

        // SPEC-053: la consulta y el saneado de secretos viven en el DAL; la ruta no toca prisma.
        const resultado = await new ConfiguracionService().obtenerConHistorial(clave);

        return NextResponse.json(resultado);
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

        // SPEC-053: crear/actualizar + cifrado de secreto + auditoría viven en el DAL.
        const param = await new ConfiguracionService().actualizar(clave, body, user.id);

        invalidateCache("public_params");
        return NextResponse.json(param);
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

        // SPEC-053: la protección de críticos y el borrado viven en el DAL.
        await new ConfiguracionService().eliminar(clave);
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
