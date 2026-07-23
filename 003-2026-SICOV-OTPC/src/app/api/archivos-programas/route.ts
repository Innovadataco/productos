import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { subirPrograma, listarProgramas } from "@/lib/mantenimientos/archivos";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// POST /api/archivos-programas — sube el PDF del programa. Roles 1 y 2: es el lado del CLIENTE
/// del módulo mantenimientos (§10.2) — el operador NO gestiona el programa. Guard D-017.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "mantenimientos");
    const form = await req.formData().catch(() => null);
    const archivo = form?.get("archivo");
    const tipoId = form?.get("tipoId");
    if (!archivo || !(archivo instanceof File) || !tipoId) {
      throw new AppError("Todos los campos son requeridos (archivo, tipoId)", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const r = await subirPrograma(
      {
        tipoId,
        nombreOriginal: archivo.name ?? "programa.pdf",
        contentType: archivo.type ?? "",
        tamano: archivo.size,
        buffer: Buffer.from(await archivo.arrayBuffer()),
      },
      { id: u.id, identificacion: u.identificacion, rolId: u.rolId },
    );
    return NextResponse.json(r, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// GET /api/archivos-programas?tipoId=1|2[&vigiladoId=] — lista (activo primero). Roles 1,2,3;
/// alcance D-015 server-side (vigiladoId solo surte efecto para rol 1).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const { searchParams } = new URL(req.url);
    const tipoId = searchParams.get("tipoId");
    if (!tipoId) {
      throw new AppError("Todos los campos son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const items = await listarProgramas(
      tipoId,
      { id: u.id, identificacion: u.identificacion, rolId: u.rolId },
      searchParams.get("vigiladoId"),
    );
    if (items.length === 0) {
      return NextResponse.json({ mensaje: "No se encontraron archivos", items: [] }, { status: 404 });
    }
    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
