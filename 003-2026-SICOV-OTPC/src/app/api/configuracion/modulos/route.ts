import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

/// GET /api/configuracion/modulos — catálogo de módulos ASIGNABLES a una empresa (rol 1).
/// Excluye `inicio` (implícito) y `configuracion` (solo plataforma, no se cede a clientes).
export async function GET() {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion");
    const filas = await prisma.modulo.findMany({
      where: { estado: true, nombre: { notIn: ["inicio", "configuracion"] } },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, nombreMostrar: true },
    });
    return NextResponse.json({ items: filas });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
