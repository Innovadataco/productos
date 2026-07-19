import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, EvalRunEstado, type Prisma } from "@prisma/client";
import { getCurrentProductionConfig, type ExperimentConfigSnapshot } from "@/lib/ai/eval-runner";
import { listOllamaModels } from "@/lib/ai/ollama-config";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPgBoss() {
    const { PgBoss } = await import("pg-boss");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL no configurada");
    return new PgBoss(databaseUrl);
}

const configOverrideSchema = z.object({
    modeloClasificacion: z.string().optional(),
    modeloEmbedding: z.string().optional(),
    umbralRevision: z.number().min(0).max(2).optional(),
    nVotos: z.number().int().min(1).max(10).optional(),
    temperaturaVotos: z.number().min(0).max(2).optional(),
    ragTopK: z.number().int().min(0).max(10).optional(),
});

const createSchema = z.object({
    nombre: z.string().min(1).max(120),
    notas: z.string().max(2000).optional(),
    config: configOverrideSchema.optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const enProgreso = await prisma.evalRun.findFirst({
            where: { estado: { in: [EvalRunEstado.PENDIENTE, EvalRunEstado.EN_PROGRESO] } },
        });
        if (enProgreso) {
            throw new AppError(
                `Ya hay una corrida en curso (${enProgreso.id}). Espere a que termine.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const productionConfig = await getCurrentProductionConfig();
        const overrides = parsed.data.config || {};
        const configSnapshot: ExperimentConfigSnapshot = {
            ...productionConfig,
            ...overrides,
        };

        // Validar modelo contra modelos instalados.
        const installed = await listOllamaModels(configSnapshot.ollamaBaseUrl);
        const installedNames = installed.map((m) => `${m.name}:${m.tag}`);
        if (!installedNames.includes(configSnapshot.modeloClasificacion)) {
            throw new AppError(
                `El modelo ${configSnapshot.modeloClasificacion} no está instalado en Ollama`,
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const examplesCount = await prisma.casoEval.count({ where: { activo: true } });
        if (examplesCount === 0) {
            throw new AppError("No hay casos activos para evaluar", ERROR_CODES.CONFLICT, 409);
        }

        const estimacionMinutos = Math.max(1, Math.ceil((examplesCount * 7) / 60));

        const run = await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion: configSnapshot.fixtureVersion,
                estado: EvalRunEstado.PENDIENTE,
                creadoPorId: user.id,
                nombre: parsed.data.nombre,
                notas: parsed.data.notas || null,
                configSnapshot: configSnapshot as unknown as Prisma.InputJsonValue,
                progresoTotal: examplesCount,
            },
        });

        const boss = await getPgBoss();
        await boss.start();
        await boss.send("eval-classifier-run", { runId: run.id, fixtureVersion: configSnapshot.fixtureVersion });
        await boss.stop();

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "EXPERIMENT_START",
            tipoRecurso: "EvalRun",
            recursoId: run.id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ nombre: run.nombre, configSnapshot }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json(
            {
                runId: run.id,
                estado: run.estado,
                fixtureVersion: configSnapshot.fixtureVersion,
                totalCasos: examplesCount,
                estimacionMinutos,
            },
            { status: 202 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: { message, code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const estado = searchParams.get("estado") || undefined;
        const fixtureVersion = searchParams.get("fixtureVersion");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const pageSize = 20;

        const where: Record<string, unknown> = {};
        if (estado) where.estado = estado;
        if (fixtureVersion) where.fixtureVersion = parseInt(fixtureVersion, 10);

        const [items, total] = await prisma.$transaction([
            prisma.evalRun.findMany({
                where,
                orderBy: { iniciadoEn: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { creadoPor: { select: { email: true, nombre: true } } },
            }),
            prisma.evalRun.count({ where }),
        ]);

        return NextResponse.json({
            items,
            pagination: { page, totalPages: Math.ceil(total / pageSize), total },
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
