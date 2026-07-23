import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { modificarToken } from "@/lib/configuracion/empresas";
import { AppError } from "@/lib/errors";

/// PATCH /api/configuracion/empresas/[nit]/token — modifica el token (sincroniza admin). Rol 1.
export async function PATCH(req: Request, ctx: { params: Promise<{ nit: string }> }) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const { nit } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    await modificarToken(nit, String(body.token ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
