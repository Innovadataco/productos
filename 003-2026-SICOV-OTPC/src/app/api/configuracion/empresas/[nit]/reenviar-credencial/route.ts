import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { reenviarCredencial } from "@/lib/configuracion/empresas";
import { AppError } from "@/lib/errors";

/// POST /api/configuracion/empresas/[nit]/reenviar-credencial — regenera clave temporal y reenvía.
export async function POST(_req: Request, ctx: { params: Promise<{ nit: string }> }) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const { nit } = await ctx.params;
    const enviado = await reenviarCredencial(nit);
    return NextResponse.json({ ok: true, correoEnviado: enviado });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
