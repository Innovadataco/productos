/**
 * SPEC-427 (A-75 · L6) · POST /api/profesional/citas/[id]/cerrar
 *
 * El profesional digita el código que el padre le dio de viva voz en la sesión.
 * Si coincide, la cita queda `CUMPLIDA`. Es el único camino que escribe ese
 * estado en todo el producto.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { cerrarConCodigoDeCita } from "@/lib/profesional/cita/cierre.service";

// Seis dígitos exactos. Se valida acá para que un cuerpo cualquiera no llegue
// a gastar un bcrypt ni un intento del padre.
const cuerpo = z.object({ codigo: z.string().regex(/^\d{6}$/, "El código son 6 dígitos.") });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await ctx.params;
        const { codigo } = cuerpo.parse(await req.json());
        const r = await cerrarConCodigoDeCita(id, user.id, codigo);
        return NextResponse.json({ data: r });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CITAS/CERRAR]");
    }
}
