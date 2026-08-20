import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ventanaAntiAbusoSchema } from "@/lib/schemas";
import { obtenerTableroAntiAbuso } from "@/lib/anti-abuso/tablero";

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
        const parsed = ventanaAntiAbusoSchema.safeParse(searchParams.get("ventana") ?? undefined);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Ventana inválida. Use 24h, 7d o 30d.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const tablero = await obtenerTableroAntiAbuso(parsed.data);
        return NextResponse.json(tablero);
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
