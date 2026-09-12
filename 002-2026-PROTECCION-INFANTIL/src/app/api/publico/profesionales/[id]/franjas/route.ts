/**
 * SPEC-395 (L4) · GET /api/publico/profesionales/[id]/franjas
 * Franjas libres futuras de un profesional ACTIVO. Es el paso de AGENDAR del
 * `SolicitarCitaPanel` (el padre elige la franja acá), no una previsualización:
 * `SolicitudCita` exige `franjaId`, así que sin franjas no hay cita.
 * Sesión OPCIONAL (SPEC-655): el visor sale de la COOKIE para que un padre SEMBRADO
 * vea las franjas de un profesional sembrado; un anónimo o un padre real, no.
 */
import { NextResponse } from "next/server";
import { errorToResponse } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        // L3 (#298): `obtenerPublicoPorId` filtra por `estado = ACTIVO` con la
        // allowlist del brief §5 — no destapa contacto ni campos internos.
        // SPEC-655/681: visor SOLO de la cookie de sesión (`getSessionUser`), NUNCA de
        // un parámetro/header — eso sería spoofeable = muro que falla ABIERTO. Falla
        // CERRADA: sin sesión, o sesión no-demo → visor real → se excluye el sembrado;
        // solo un padre SEMBRADO ve (y puede agendar con) un profesional sembrado.
        const viewer = (await getSessionUser())?.id ?? null;
        const perfil = await new PerfilProfesionalRepository().obtenerPublicoPorId(id, viewer);
        if (!perfil) {
            throw new AppError("Profesional no disponible", ERROR_CODES.NOT_FOUND, 404);
        }
        const franjas = await new FranjaDisponibleRepository().listarLibresDeProfesional(perfil.id, new Date());
        return NextResponse.json({
            data: franjas.map((f) => ({
                id: f.id,
                inicio: f.inicio.toISOString(),
                fin: f.fin.toISOString(),
                modalidad: f.modalidad,
            })),
        });
    } catch (error) {
        return errorToResponse(error, "[PUBLICO/PROFESIONAL/FRANJAS]");
    }
}
