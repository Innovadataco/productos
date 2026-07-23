import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { listarPlacas } from "@/lib/mantenimientos/servicio";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// GET /api/mantenimientos/placas?tipoId=1|2 — proxy a la Super (stub/real). El vigilado es
/// SIEMPRE el NIT efectivo server-side (D-015): se ignora cualquier nit del cliente.
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos");
    const { searchParams } = new URL(req.url);
    const tipoId = searchParams.get("tipoId");
    if (!tipoId) {
      throw new AppError("Todos los campos son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const r = await listarPlacas(tipoId, u.identificacion ?? "", u.rolId ?? 0);
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
