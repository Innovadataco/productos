/**
 * SPEC-427b (A-75 · L6) · el código de expediente.
 *
 * POST · el profesional digita el código que el padre le dio en la sesión →
 *        queda habilitado a leer el expediente.
 * GET  · devuelve el expediente en SOLO LECTURA (las mismas cifras que ve el
 *        padre). Cada lectura se audita (H-2).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import {
    abrirExpedienteConCodigo,
    lecturaExpedienteParaProfesional,
} from "@/lib/profesional/cita/expediente.service";

const cuerpo = z.object({ codigo: z.string().regex(/^\d{6}$/, "El código son 6 dígitos.") });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await ctx.params;
        const { codigo } = cuerpo.parse(await req.json());
        const r = await abrirExpedienteConCodigo(id, user.id, codigo);
        return NextResponse.json({ data: r });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CITAS/EXPEDIENTE/POST]");
    }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await ctx.params;
        const lectura = await lecturaExpedienteParaProfesional(id, user.id);
        if (!lectura) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado", code: "NOT_FOUND" } },
                { status: 404 }
            );
        }
        return NextResponse.json({ data: lectura });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CITAS/EXPEDIENTE/GET]");
    }
}
