import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { NotificacionUsuarioBandejaService } from "@/lib/notificaciones/bandeja-usuario";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const count = await new NotificacionUsuarioBandejaService().contarNoLeidas(user.id);
        return NextResponse.json({ noLeidas: count });
    } catch (error) {
        return errorToResponse(error, "[NOTIFICACIONES/RESUMEN]");
    }
}
