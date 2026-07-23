import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { listarJobsFallidos } from "@/lib/mantenimientos/cola";
import { AppError } from "@/lib/errors";

/// GET /api/mantenimientos/jobs/fallidos — log de errores para revisión (§11.2).
/// Alcance D-015 server-side (`nit` del cliente solo surte efecto para rol 1).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const q = new URL(req.url).searchParams;
    const items = await listarJobsFallidos(u.identificacion ?? "", u.rolId ?? 0, {
      tipo: q.get("tipo"),
      nit: q.get("nit"),
    });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
