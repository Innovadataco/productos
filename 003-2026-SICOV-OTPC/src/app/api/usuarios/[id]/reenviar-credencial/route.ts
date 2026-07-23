import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { reenviarCredencialUsuario } from "@/lib/configuracion/usuarios";
import { AppError } from "@/lib/errors";

/// POST /api/usuarios/[id]/reenviar-credencial — regenera clave temporal y reenvía (alcance D-015).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2]);
    await requiereModulo(u, "usuarios");
    const { id } = await ctx.params;
    const enviado = await reenviarCredencialUsuario(
      { id: u.id, rolId: u.rolId, identificacion: u.identificacion },
      Number(id),
    );
    return NextResponse.json({ ok: true, correoEnviado: enviado });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
