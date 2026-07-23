import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { actualizarUsuario, type AsignacionModulo } from "@/lib/configuracion/usuarios";
import { AppError } from "@/lib/errors";

/// PATCH /api/usuarios/[id] — nombre/correo/estado/permisos (identificación y rol NO editables).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "usuarios");
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await actualizarUsuario(
      { id: u.id, rolId: u.rolId, identificacion: u.identificacion },
      Number(id),
      {
        nombre: body["nombre"] as string | undefined,
        correo: body["correo"] as string | undefined,
        estado: typeof body["estado"] === "boolean" ? (body["estado"] as boolean) : undefined,
        permisos: Array.isArray(body["permisos"]) ? (body["permisos"] as AsignacionModulo[]) : undefined,
      },
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
