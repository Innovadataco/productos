import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SimulacionAbusoRepository, type ResultadosSimulacionAbuso } from "@/lib/dal/repositories/simulacion-abuso";
import { descripcionEscenario } from "@/lib/anti-abuso/descripcion-escenario";

function extraerResultados(run: { resultadosJson: unknown }): Partial<ResultadosSimulacionAbuso> {
    const datos = (run.resultadosJson ?? {}) as Record<string, unknown>;
    return datos;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "anti_abuso");
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const run = await new SimulacionAbusoRepository().findById(id);
        if (!run) {
            return NextResponse.json(
                { error: { message: "Simulación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const config = (run.configJson ?? {}) as Record<string, unknown>;
        const resultados = extraerResultados(run);
        const detalles = Array.isArray(resultados.detalles) ? resultados.detalles : [];

        return NextResponse.json({
            run: {
                ...run,
                n: run.totalReportes,
                ipInyectada: config.ipInyectada ?? null,
                identificador: config.identificador ?? null,
                plataforma: config.plataforma ?? null,
                usuarioId: config.usuarioId ?? null,
                totalEsperado: run.totalReportes,
                totalEnviados: Number(resultados.totalEnviados ?? 0),
                totalBloqueados: Number(resultados.totalBloqueados ?? 0),
                totalSpam: Number(resultados.totalSpam ?? 0),
                latenciaPromedioMs: Number(resultados.latenciaPromedioMs ?? 0),
                latenciaP50Ms: Number(resultados.latenciaP50Ms ?? 0),
                latenciaP95Ms: Number(resultados.latenciaP95Ms ?? 0),
                descripcionEscenario: descripcionEscenario(run.escenario),
                detalles,
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
