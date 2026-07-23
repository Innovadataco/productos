import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { reintentarSolicitud } from "@/lib/despachos/cola";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// Reintento manual de una solicitud fallida (corrige bug 2: el botón del demo no tenía handler).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "salidas"); // D-017
    const { id } = await ctx.params;
    const solicitudId = Number(id);
    if (!Number.isFinite(solicitudId) || solicitudId <= 0) {
      throw new AppError("Id inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const s = await reintentarSolicitud(solicitudId);
    return NextResponse.json({ ok: true, estado: s.estado, reintentos: s.reintentos });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
