import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { AppError } from "@/lib/errors";

/// Rutas activas de la empresa (read-through, stub por defecto) para poblar obj_rutas del wizard.
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    const { searchParams } = new URL(req.url);
    const nit =
      searchParams.get("nit") ||
      (u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? ""));
    const rutas = await getClienteSupertransporte().consultarRutasActivas(nit);
    return NextResponse.json({ items: rutas });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
