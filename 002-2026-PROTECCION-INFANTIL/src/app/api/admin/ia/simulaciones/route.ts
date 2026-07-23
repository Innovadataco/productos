import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { isEmbeddingModel } from "@/lib/ai/ollama-config";
import { sendSimulacionLote } from "@/lib/queue";
import { parsearArchivoSimulacion, normalizarCategoriaEsperada } from "@/lib/simulacion/parser";
import { CASO_MAXIMO, crearSimulacionSchema } from "@/lib/schemas/simulacion";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

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

        const casos = parseo.casos!.map((c) => ({
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

        const enProgreso = await prisma.simulacionRun.findFirst({
            where: { estado: { in: ["PENDIENTE", "EN_PROGRESO"] } },
        });
        if (enProgreso) {
            throw new AppError(
                `Ya hay una simulación en curso (${enProgreso.id}). Espere a que termine o cancele.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const runIds: string[] = [];
        for (const modelo of modelos) {
            const run = await prisma.simulacionRun.create({
                data: {
                    modelo,
                    totalCasos: casos.length,
                    estado: "PENDIENTE",
                    casosJson: casos as any,
                    creadoPorId: user.id,
                },
            });
            runIds.push(run.id);
        }

        await sendSimulacionLote(runIds);

        return NextResponse.json(
            {
                runIds,
                estado: "PENDIENTE",
                totalCasos: casos.length,
            },
            { status: 202 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[IA-SIMULACIONES] Error creando simulación:", error);
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
        const pageSize = 20;

        const where: Record<string, unknown> = {};
        if (estado) where.estado = estado;

        const [items, total] = await prisma.$transaction([
            prisma.simulacionRun.findMany({
                where,
                orderBy: { fechaInicio: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { creadoPor: { select: { email: true, nombre: true } } },
            }),
            prisma.simulacionRun.count({ where }),
        ]);

        return NextResponse.json({ items, pagination: { page, totalPages: Math.ceil(total / pageSize), total } });
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
