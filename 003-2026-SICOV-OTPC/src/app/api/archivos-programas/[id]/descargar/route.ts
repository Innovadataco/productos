import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { leerPrograma } from "@/lib/mantenimientos/archivos";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// GET /api/archivos-programas/[id]/descargar — streaming del PDF (solo del propio vigilado;
/// rol 1 todo — D-015). Guard D-017. Nunca expone rutas del filesystem.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const { id } = await ctx.params;
    const archivoId = Number(id);
    if (!Number.isInteger(archivoId) || archivoId <= 0) {
      throw new AppError("Id inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const { nombreOriginal, buffer } = await leerPrograma(archivoId, {
      id: u.id,
      identificacion: u.identificacion,
      rolId: u.rolId,
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreOriginal.replace(/"/g, "")}"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
