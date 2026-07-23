import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { listarHistorial } from "@/lib/mantenimientos/servicio";
import { historialAXlsx } from "@/lib/mantenimientos/excel";
import { extraerLista } from "@/lib/normalizar";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { NextResponse } from "next/server";

/// GET /api/mantenimientos/historial/exportar?tipoId=&placa= — exporta el historial a XLSX.
/// CON autenticación y guard: el `exportar-historial` público del legacy era un bug (no se replica).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos");
    const { searchParams } = new URL(req.url);
    const tipoId = searchParams.get("tipoId");
    const placa = searchParams.get("placa");
    if (!tipoId || !placa) {
      throw new AppError("Todos los campos son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const r = await listarHistorial(tipoId, placa, u.identificacion ?? "", u.rolId ?? 0);
    const filas = extraerLista<Record<string, unknown>>(r);
    const buffer = await historialAXlsx(filas);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=Historial.xlsx",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
