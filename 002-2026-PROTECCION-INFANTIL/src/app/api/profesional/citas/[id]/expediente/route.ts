/**
 * SPEC-427 (A-75 · L6) · POST /api/profesional/citas/[id]/expediente
 *
 * El segundo código: el que abre el expediente. Solo existe si el padre eligió
 * compartirlo, y solo vale si el padre se lo entrega en la sesión. Por eso la
 * autorización no es una casilla marcada días antes — es un acto del momento.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { abrirExpedienteConCodigo } from "@/lib/profesional/cita/cierre.service";

const cuerpo = z.object({ codigo: z.string().regex(/^\d{6}$/, "El código son 6 dígitos.") });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await ctx.params;
        const { codigo } = cuerpo.parse(await req.json());
        const r = await abrirExpedienteConCodigo(id, user.id, codigo);
        return NextResponse.json({ data: r });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CITAS/EXPEDIENTE]");
    }
}
