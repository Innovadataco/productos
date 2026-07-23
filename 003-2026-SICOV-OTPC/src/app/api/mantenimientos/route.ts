import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { guardarBase } from "@/lib/mantenimientos/servicio";
import { AppError } from "@/lib/errors";

/// POST /api/mantenimientos — mantenimiento BASE (paso 1 del registro individual).
/// Roles 1 y 3: el CLIENTE (rol 2) NO registra mantenimientos (§10.2 del manual — su lado del
/// módulo es el PDF del programa, 005-B). Guard de módulo D-017. Reporte inmediato + caída a cola.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = await guardarBase(
      { vigiladoId: body["vigiladoId"], placa: body["placa"], tipoId: body["tipoId"] },
      u.identificacion ?? "",
      u.rolId ?? 0,
    );
    return NextResponse.json(r, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
