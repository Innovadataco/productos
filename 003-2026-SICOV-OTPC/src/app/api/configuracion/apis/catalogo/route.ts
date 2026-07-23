import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { CATALOGO, FASE_CONSOLA } from "@/lib/consola-apis/catalogo";
import { AppError } from "@/lib/errors";

/// GET /api/configuracion/apis/catalogo — catálogo de operaciones (rol 1 + guard configuracion/apis).
export async function GET() {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "apis");
    return NextResponse.json({ fase: FASE_CONSOLA, items: CATALOGO });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
