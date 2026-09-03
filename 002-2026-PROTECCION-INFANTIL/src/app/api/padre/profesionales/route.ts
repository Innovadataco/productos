/**
 * SPEC-392 (L3) · `GET /api/padre/profesionales` — lista pública del padre.
 *
 * Solo `estado = ACTIVO`; filtros opcionales por ciudad, especialidad y
 * modalidad. Baraja SEMBRADA POR SESIÓN — el cliente pasa `?seed=<uuid>` y
 * lo conserva mientras dura la sesión de directorio.
 *
 * **Candado H-1 · brief §1:** ruta EXENTA del guardián de vigencia
 * (`guardias.ts` · `vigencia.PARENT.exentas`). El directorio es abierto:
 * no se esconde detrás del pago.
 *
 * **Candado H-2 · Ley 2375/2024:** el DAL usa allowlist estricta; ningún
 * campo interno ni de contacto viaja en la respuesta. El barrido de tests
 * lo verifica en cada endpoint.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { barajarConSemilla, SEED_MIN_LENGTH } from "@/lib/padre/directorio-shuffle";

const querySchema = z.object({
    ciudadId: z.string().trim().min(1).max(50).optional(),
    especialidad: z.string().trim().min(1).max(80).optional(),
    modalidad: z.enum(["virtual", "presencial"]).optional(),
    seed: z.string().trim().min(SEED_MIN_LENGTH).max(128),
});

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
            ciudadId: url.searchParams.get("ciudadId") ?? undefined,
            especialidad: url.searchParams.get("especialidad") ?? undefined,
            modalidad: url.searchParams.get("modalidad") ?? undefined,
            seed: url.searchParams.get("seed") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        message: "Parámetros inválidos. Falta `seed` o formato incorrecto.",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 }
            );
        }

        const repo = new PerfilProfesionalRepository();
        const items = await repo.listarActivos({
            ciudadId: parsed.data.ciudadId,
            especialidad: parsed.data.especialidad,
            modalidad: parsed.data.modalidad,
        });
        const barajados = barajarConSemilla(items, parsed.data.seed);
        return NextResponse.json({ items: barajados });
    } catch (error) {
        return errorToResponse(error, "[PADRE/PROFESIONALES/LISTAR]");
    }
}
