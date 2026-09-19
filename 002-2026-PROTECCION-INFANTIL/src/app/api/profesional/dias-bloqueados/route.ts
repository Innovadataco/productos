/**
 * SPEC-714 · Días cerrados del profesional (bloquear/desbloquear un día de la agenda).
 * POST    — bloquea un día (`fecha` yyyy-MM-dd Bogotá, `motivo?`). Idempotente.
 * DELETE  — reabre un día. Idempotente.
 *
 * Muta → POST/DELETE, nunca GET. Misma puerta que las franjas: PROFESIONAL + habilitado
 * + módulo. `bloquear` SOLO inserta la fila del día — NO toca franjas ni citas (regla 2 del
 * CEO, imposibilidad estructural del repositorio); el día bloqueado conserva sus citas
 * confirmadas y solo impide publicar franjas nuevas ahí.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { exigirProfesionalHabilitadoApi } from "@/lib/profesionales/habilitacion";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DiaBloqueadoRepository } from "@/lib/dal/repositories/dia-bloqueado";
import { AppError, ERROR_CODES } from "@/lib/errors";

// El formato exacto (yyyy-MM-dd real) lo valida el repositorio (`exigirDiaValido`); acá basta string.
const bloquearSchema = z.object({ fecha: z.string(), motivo: z.string().max(200).optional() });
const desbloquearSchema = z.object({ fecha: z.string() });

async function perfilDe(usuarioId: string) {
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(usuarioId);
    if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
    return perfil;
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await exigirProfesionalHabilitadoApi(user.id);
        await assertModulo(user, "profesional_calendario");
        const perfil = await perfilDe(user.id);
        const body = bloquearSchema.parse(await request.json());
        await new DiaBloqueadoRepository().bloquear(perfil.id, body.fecha, body.motivo);
        return NextResponse.json({ data: { ok: true } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/DIAS-BLOQUEADOS/POST]");
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await exigirProfesionalHabilitadoApi(user.id);
        await assertModulo(user, "profesional_calendario");
        const perfil = await perfilDe(user.id);
        const body = desbloquearSchema.parse(await request.json());
        await new DiaBloqueadoRepository().desbloquear(perfil.id, body.fecha);
        return NextResponse.json({ data: { ok: true } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/DIAS-BLOQUEADOS/DELETE]");
    }
}
