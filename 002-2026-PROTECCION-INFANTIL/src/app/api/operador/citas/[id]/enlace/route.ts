/**
 * SPEC-750 · POST /api/operador/citas/[id]/enlace
 * El operador ASIGNADO publica el enlace de la reunión. Validación (https/no-HTML),
 * guardia de dueño y registro del HECHO viven en el servicio. Solo se publica EN PI.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { publicarEnlaceSesion } from "@/lib/operadores/enlace-sesion";

const bodySchema = z.object({ enlace: z.string().min(1).max(2000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("OPERADOR");
        const { id } = await context.params;
        const { enlace } = bodySchema.parse(await request.json());
        await publicarEnlaceSesion({ citaId: id, operadorId: user.id, enlaceRaw: enlace });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[OPERADOR/CITAS/ENLACE]");
    }
}
