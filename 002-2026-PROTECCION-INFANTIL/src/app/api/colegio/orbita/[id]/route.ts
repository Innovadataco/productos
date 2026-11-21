import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { cursoIdParamsSchema } from "@/lib/schemas";

/**
 * SPEC-965 (FORMA Órbita · capa 2): overview de UN curso del colegio del rector — los alumnos que
 * merecen mirada + el titular + «resto en calma». On-demand: la capa 2 se carga SOLO al abrir un curso
 * (es overview, no se dibuja todo). Mismo muro que el resto del panel del colegio: SCHOOL_ADMIN +
 * módulo + vigencia + rate limit, y tenant por `user.colegioId` (el repo 404ea un curso de otro colegio).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");

        const vigencia = await verificarVigenciaColegioSalvoCamino(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Curso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const curso = await new ColegioResumenRepository().cursoOrbita(user.colegioId, id);

        return NextResponse.json({ curso });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ORBITA]");
    }
}
