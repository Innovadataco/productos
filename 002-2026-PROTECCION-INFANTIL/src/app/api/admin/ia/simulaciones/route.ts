import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isEmbeddingModel } from "@/lib/ai/ollama-config";
import { sendSimulacionLote } from "@/lib/queue";
import { parsearArchivoSimulacion, normalizarCategoriaEsperada } from "@/lib/simulacion/parser";
import { CASO_MAXIMO, crearSimulacionSchema } from "@/lib/schemas/simulacion";
import { IaSimulacionesService } from "@/lib/dal/services/ia-simulaciones";
import { RolUsuario } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_simulaciones");

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = crearSimulacionSchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const { modelos, archivo, formato } = parsed.data;

        for (const modelo of modelos) {
            if (isEmbeddingModel(modelo)) {
                throw new AppError(
                    `No se permite usar modelos de embeddings para la clasificación (${modelo})`,
                    ERROR_CODES.VALIDATION_ERROR,
                    400
                );
            }
        }

        const parseo = parsearArchivoSimulacion(archivo, formato);
        if (!parseo.ok) {
            return NextResponse.json(
                {
                    error: {
                        message: parseo.mensaje || "Error validando el archivo",
                        code: ERROR_CODES.VALIDATION_ERROR,
                        details: parseo.errores,
                    },
                },
                { status: 400 }
            );
        }

        if (!parseo.casos) {
            // Invariante del parser: ok=true siempre trae casos. Si se rompe,
            // 400 canónico controlado (nunca un TypeError por acceso a undefined).
            return NextResponse.json(
                { error: { message: "Error validando el archivo", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const casos = parseo.casos.map((c) => ({
            ...c.caso,
            categoriaEsperada: normalizarCategoriaEsperada(c.caso.categoriaEsperada),
        }));

        if (casos.length > CASO_MAXIMO) {
            throw new AppError(
                `El archivo excede el límite de ${CASO_MAXIMO} casos por corrida`,
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        // SPEC-053: guarda de corrida única y creación de corridas viven en el
        // DAL; la ruta conserva la validación del archivo y el encolado (queue).
        const service = new IaSimulacionesService();
        await service.assertSinSimulacionEnCurso();

        const { runIds, totalCasos } = await service.crearSimulaciones({
            modelos,
            casos,
            creadoPorId: user.id,
        });

        await sendSimulacionLote(runIds);

        return NextResponse.json(
            {
                runIds,
                estado: "PENDIENTE",
                totalCasos,
            },
            { status: 202 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[IA-SIMULACIONES] Error creando simulación:", error);
        return NextResponse.json(
            { error: { message: "Error creando la simulación", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_simulaciones");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const estado = searchParams.get("estado") || undefined;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

        // SPEC-053: filtros y paginación viven en el DAL.
        const resultado = await new IaSimulacionesService().listar({ estado, page });

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
