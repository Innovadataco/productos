import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { listarLlamadas } from "@/lib/consola-apis/bitacora";
import { AppError } from "@/lib/errors";

/// GET /api/configuracion/apis/llamadas — bitácora paginada con filtros (rol 1 + guard).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "apis");
    const { searchParams } = new URL(req.url);
    const r = await listarLlamadas(
      {
        operacion: searchParams.get("operacion"),
        modo: searchParams.get("modo"),
        status: searchParams.get("status"),
        desde: searchParams.get("desde"),
        hasta: searchParams.get("hasta"),
      },
      searchParams.get("page"),
      searchParams.get("pageSize"),
    );
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
