import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { crearUsuario, listarUsuarios, type AsignacionModulo } from "@/lib/configuracion/usuarios";
import { AppError } from "@/lib/errors";

function ctxDe(u: { id: number; rolId: number | null; identificacion: string | null }) {
  return { id: u.id, rolId: u.rolId, identificacion: u.identificacion };
}

/// GET /api/usuarios — listado del alcance (rol 1 ve todo; rol 2 solo su NIT). Paginado 25/100.
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "usuarios");
    const { searchParams } = new URL(req.url);
    const r = await listarUsuarios(ctxDe(u), searchParams.get("page"), searchParams.get("pageSize"));
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// POST /api/usuarios — crea rol 2/3 en el alcance del otorgante (subconjunto server-side + B2).
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "usuarios");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = await crearUsuario(ctxDe(u), {
      nombre: String(body["nombre"] ?? ""),
      identificacion: String(body["identificacion"] ?? ""),
      correo: String(body["correo"] ?? ""),
      rolId: (body["rolId"] === 2 ? 2 : 3),
      empresaNit: body["empresaNit"] as string | undefined,
      permisos: Array.isArray(body["permisos"]) ? (body["permisos"] as AsignacionModulo[]) : [],
    });
    return NextResponse.json(r, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
