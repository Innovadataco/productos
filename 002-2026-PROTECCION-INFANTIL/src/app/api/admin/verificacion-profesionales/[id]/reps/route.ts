/**
 * SPEC-790 (T6) · POST /api/admin/verificacion-profesionales/[id]/reps
 *
 * El admin TRANSCRIBE una verificación de habilitación (REPS) de la fuente oficial — NO decide, copia.
 * Append-only: una corrección es una carga nueva, no un borrón. Dos compuertas:
 *  · SERVIDOR (`assertModulo`): quién puede cargar (no se esconde un botón; la guardia va acá, SPEC-690/691).
 *  · CÓDIGO (en el service, ANTES del CHECK): un VIGENTE sin fecha/modalidades se rechaza con AppError, no
 *    con el error crudo de la base. El actor va al snapshot durable (email del admin).
 *
 * NO muta `habilitado` (REPS es el eje «ofrecible», separado). El cableado resultado→visibilidad lo deriva
 * `repsAlDia`/`idsOfrecibles`, no esta ruta.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { EstadoReps, ModalidadReps } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { registrarVerificacionManualReps } from "@/lib/dal/services/verificacion-reps";

const bodySchema = z.object({
    resultado: z.nativeEnum(EstadoReps),
    // Solo aplica a VIGENTE; el service valida la exigencia (y normaliza a null para los otros).
    vigenteHasta: z.string().datetime({ offset: true }).nullish(),
    modalidades: z.array(z.nativeEnum(ModalidadReps)).default([]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id } = await ctx.params;
        const body = bodySchema.parse(await req.json());
        const fila = await registrarVerificacionManualReps(
            {
                profesionalId: id,
                resultado: body.resultado,
                vigenteHasta: body.vigenteHasta ? new Date(body.vigenteHasta) : null,
                modalidades: body.modalidades,
            },
            { usuarioId: user.id, snapshot: user.email },
        );
        return NextResponse.json({ data: { id: fila.id, resultado: fila.resultado, verificadoEn: fila.verificadoEn.toISOString() } });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/REPS]");
    }
}
