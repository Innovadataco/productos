import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { sugerenciasSimulacionAbusoQuerySchema } from "@/lib/schemas";
import { generarSugerenciasPorEscenario } from "@/lib/anti-abuso/sugerencias-simulador";

export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url);
        const parsed = sugerenciasSimulacionAbusoQuerySchema.safeParse({
            escenario: searchParams.get("escenario") ?? undefined,
        });
        if (!parsed.success) {
            const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; ");
            return NextResponse.json(
                { error: { message: `Parámetros inválidos — ${detalle}`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const sugerencias = await generarSugerenciasPorEscenario(parsed.data.escenario);
        return NextResponse.json({ ok: true, sugerencias });
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
