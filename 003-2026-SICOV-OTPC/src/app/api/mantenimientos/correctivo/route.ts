import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { guardarDetalle } from "@/lib/mantenimientos/servicio";
import { AppError } from "@/lib/errors";
import type { RegistroDetalle } from "@/lib/mantenimientos/tipos";

/// POST /api/mantenimientos/correctivo — detalle (paso 2). Roles 1,3 (§10.2) + guard D-017.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos", "correctivos");
    const body = (await req.json().catch(() => ({}))) as Partial<RegistroDetalle> & {
      mantenimientoId?: unknown;
    };
    const r = await guardarDetalle(2, body, u.identificacion ?? "", u.rolId ?? 0);
    return NextResponse.json(r, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
