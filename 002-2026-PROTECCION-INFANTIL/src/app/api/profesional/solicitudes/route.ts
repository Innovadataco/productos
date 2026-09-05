/**
 * SPEC-395 (L4) · GET /api/profesional/solicitudes
 * Lista las solicitudes del profesional autenticado.
 * Excepción del contacto del padre: solo cuando CONFIRMADA. El DTO lo garantiza.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { toCitaParaProfesional } from "@/lib/profesional/cita/dto";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_citaciones");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const solicitudes = await new SolicitudCitaRepository().listarPorProfesional(perfil.id);
        return NextResponse.json({ data: solicitudes.map((s) => toCitaParaProfesional(s)) });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/SOLICITUDES/GET]");
    }
}
