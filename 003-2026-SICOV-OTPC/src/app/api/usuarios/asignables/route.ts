import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { asignablesDelOtorgante } from "@/lib/configuracion/usuarios";
import { AppError } from "@/lib/errors";

/// GET /api/usuarios/asignables — árbol módulos→submódulos que el otorgante puede ceder (D-015).
export async function GET() {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "usuarios");
    const items = await asignablesDelOtorgante({ id: u.id, rolId: u.rolId, identificacion: u.identificacion });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
