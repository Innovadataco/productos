import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { obtenerPatronesColegio, periodoTrimestre } from "@/lib/colegio/patrones";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODO_REGEX = /^\d{4}-Q[1-4]$/;

/**
 * GET /api/colegio/patrones?periodo=2026-Q3 (SPEC-142, F6)
 * Informe de patrones del colegio (conteos agregados por grado, conducta y
 * plataforma con k-anonimato k=3 en TODOS los desgloses — ZEUS D-2). Nunca
 * identificadores, nombres ni textos. Mismas guardas que /api/colegio/estadisticas.
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Tu cuenta no está vinculada a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const periodoParam = url.searchParams.get("periodo");
        if (periodoParam && !PERIODO_REGEX.test(periodoParam)) {
            return NextResponse.json(
                { error: { message: "Formato de período inválido (esperado: 2026-Q3)", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const periodo = periodoParam ?? periodoTrimestre(new Date());

        const patrones = await obtenerPatronesColegio(user.colegioId, periodo);
        return NextResponse.json(patrones);
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
