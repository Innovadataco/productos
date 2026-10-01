/**
 * SPEC-832 (pieza 2) · POST /api/admin/reubicaciones/[id]/reasignar — el admin reubica la cita `[id]` a
 * `nuevoProfesionalId` tomando su turno `nuevaFranjaId` (art. 19). El service `reubicarCitaPorAdmin` impone
 * todo el contrato: solo CONFIRMADA, a OTRO, y —reusando `crearSolicitudCita`— B ofrecible + REPS POR
 * MODALIDAD. NO cancela: mueve.
 *
 * ⚠️ Carrera picker→confirmar: entre que el operador ve el turno y confirma, B puede caducar (el REPS se
 * reevalúa con el tiempo). El service lo RECHAZA, y `errorToResponse` lo entrega como el mensaje de «no
 * disponible» (400), NO como un 500 — el operador entiende qué pasó y re-calza, no ve un error mudo.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { cuidIdSchema } from "@/lib/schemas/base";
import { reubicarCitaPorAdmin } from "@/lib/profesional/cita/cita.service";

const bodySchema = z.object({
    nuevoProfesionalId: cuidIdSchema,
    nuevaFranjaId: cuidIdSchema,
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const { id } = await context.params;
        const { nuevoProfesionalId, nuevaFranjaId } = bodySchema.parse(await request.json());
        const nueva = await reubicarCitaPorAdmin({
            adminId: admin.id,
            solicitudId: id,
            nuevoProfesionalId,
            nuevaFranjaId,
        });
        return NextResponse.json({ data: { id: nueva.id } });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/REUBICACIONES/REASIGNAR]");
    }
}
