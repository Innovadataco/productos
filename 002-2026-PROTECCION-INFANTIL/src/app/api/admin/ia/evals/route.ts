import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, EvalRunEstado } from "@prisma/client";

// pg-boss se importa dinámicamente para no cargarlo en el bundle edge/cliente.
async function getPgBoss() {
    const { PgBoss } = await import("pg-boss");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL no configurada");
    return new PgBoss(databaseUrl);
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

        const enProgreso = await prisma.evalRun.findFirst({
            where: { estado: { in: [EvalRunEstado.PENDIENTE, EvalRunEstado.EN_PROGRESO] } },
        });
        if (enProgreso) {
            throw new AppError(
                `Ya hay una corrida en curso (${enProgreso.id}). Esperá a que termine.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const { examples, fixtureVersion } = await import("@/lib/ai/eval-runner").then((m) =>
            m.loadActiveEvalCases()
        );
        if (examples.length === 0) {
            throw new AppError("No hay casos activos para evaluar", ERROR_CODES.CONFLICT, 409);
        }

        const estimacionMinutos = Math.max(1, Math.ceil((examples.length * 7) / 60));

        const run = await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion,
                estado: EvalRunEstado.PENDIENTE,
                creadoPorId: user.id,
            },
        });

        const boss = await getPgBoss();
        await boss.start();
        await boss.send("eval-classifier-run", { runId: run.id, fixtureVersion });
        await boss.stop();

        return NextResponse.json(
            {
                runId: run.id,
                estado: run.estado,
                fixtureVersion,
                totalCasos: examples.length,
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
