import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { simularAbusoBodySchema } from "@/lib/schemas";
import { crearSimulacionAbuso } from "@/lib/anti-abuso/simulador";

export async function POST(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "anti_abuso");
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await req.json();
        const parsed = simularAbusoBodySchema.safeParse(body);
        if (!parsed.success) {
            const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
            return NextResponse.json(
                { error: { message: `Parámetros inválidos — ${detalle}`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const run = await crearSimulacionAbuso(parsed.data, user.id);
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
