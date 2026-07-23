import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { detalleEmpresa, actualizarEmpresa } from "@/lib/configuracion/empresas";
import { AppError } from "@/lib/errors";

/// GET /api/configuracion/empresas/[nit] — detalle (token visible solo rol 1; sin clave).
export async function GET(_req: Request, ctx: { params: Promise<{ nit: string }> }) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const { nit } = await ctx.params;
    const r = await detalleEmpresa(nit, true); // rol 1 → token visible
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// PATCH /api/configuracion/empresas/[nit] — datos/vigencia/estado (NIT y rol inmutables).
export async function PATCH(req: Request, ctx: { params: Promise<{ nit: string }> }) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const { nit } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await actualizarEmpresa(nit, {
      empresa: body["empresa"] as string | undefined,
      correo: body["correo"] as string | undefined,
      fechaInicial: (body["fechaInicial"] as string) ?? undefined,
      fechaFinal: (body["fechaFinal"] as string) ?? undefined,
      estado: typeof body["estado"] === "boolean" ? (body["estado"] as boolean) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
