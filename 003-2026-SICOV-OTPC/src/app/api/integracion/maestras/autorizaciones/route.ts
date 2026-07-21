import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { limpiarPlaca } from "@/lib/normalizar";
import { AppError } from "@/lib/errors";

/// Autorizaciones aplicables (read-through, stub por defecto) para array_autorizaciones del wizard.
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    const { searchParams } = new URL(req.url);
    const nit =
      searchParams.get("nit") ||
      (u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? ""));
    const placa = limpiarPlaca(searchParams.get("placa"));
    const fecha = searchParams.get("fecha") ?? "";
    const items = await getClienteSupertransporte().consultarAutorizaciones(nit, placa, fecha);
    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
