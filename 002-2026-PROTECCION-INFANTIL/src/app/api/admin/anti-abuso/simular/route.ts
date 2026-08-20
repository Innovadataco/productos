import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { simularAbusoBodySchema, simulacionAbusoQuerySchema } from "@/lib/schemas";
import { crearSimulacionAbuso } from "@/lib/anti-abuso/simulador";
import { SimulacionAbusoRepository } from "@/lib/dal/repositories/simulacion-abuso";

async function verificarAdmin(req: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth();
    await assertModulo(user, "anti_abuso");
    if (String(user.rol) !== "ADMIN") {
        return {
            permitido: false as const,
            respuesta: NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            ),
        };
    }

    const rate = await checkRateLimit(req, scope, { identifier: user.id });
    if (!rate.allowed) {
        return {
            permitido: false as const,
            respuesta: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    return { permitido: true as const, user };
}

export async function GET(req: Request) {
    try {
        const auth = await verificarAdmin(req, "admin_read");
        if (!auth.permitido) return auth.respuesta;

        const { searchParams } = new URL(req.url);
        const parsed = simulacionAbusoQuerySchema.safeParse({
            estado: searchParams.get("estado") ?? undefined,
            escenario: searchParams.get("escenario") ?? undefined,
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
        });
        if (!parsed.success) {
            const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; ");
            return NextResponse.json(
                { error: { message: `Parámetros inválidos — ${detalle}`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const repo = new SimulacionAbusoRepository();
        const listado = await repo.listar(parsed.data);

        return NextResponse.json({
            items: listado.items.map((run) => {
                const resultados = (run.resultadosJson ?? {}) as Record<string, unknown>;
                return {
                    ...run,
                    n: run.totalReportes,
                    totalEnviados: Number(resultados.totalEnviados ?? 0),
                    totalBloqueados: Number(resultados.totalBloqueados ?? 0),
                    totalSpam: Number(resultados.totalSpam ?? 0),
                    latenciaP50Ms: Number(resultados.latenciaP50Ms ?? 0),
                };
            }),
            pagination: {
                page: listado.page,
                pageSize: listado.pageSize,
                total: listado.total,
                totalPages: Math.ceil(listado.total / listado.pageSize),
            },
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

export async function POST(req: Request) {
    try {
        const auth = await verificarAdmin(req, "admin_write");
        if (!auth.permitido) return auth.respuesta;

        const body = await req.json();
        const parsed = simularAbusoBodySchema.safeParse(body);
        if (!parsed.success) {
            const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
            return NextResponse.json(
                { error: { message: `Parámetros inválidos — ${detalle}`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const run = await crearSimulacionAbuso(parsed.data, auth.user.id);
        return NextResponse.json({ ok: true, runId: run.id, estado: run.estado }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const mensaje = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json(
            { error: { message: mensaje, code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
