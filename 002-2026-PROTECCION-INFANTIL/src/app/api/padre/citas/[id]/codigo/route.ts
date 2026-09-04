/**
 * SPEC-427 (A-75 · L6) · POST /api/padre/citas/[id]/codigo
 *
 * «Si el código vence, el padre pide otro desde la plataforma, las veces que
 * haga falta» (brief §9 momento 6). El tope por ventana no es un castigo: evita
 * que la pantalla se use como máquina de mandar correos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { pedirOtroCodigoDeCita } from "@/lib/profesional/cita/cierre.service";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await ctx.params;
        const r = await pedirOtroCodigoDeCita(id, user.id);
        return NextResponse.json({ data: r });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/CODIGO]");
    }
}
