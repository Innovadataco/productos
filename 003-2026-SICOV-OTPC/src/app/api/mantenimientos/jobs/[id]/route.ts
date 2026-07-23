import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { obtenerJob } from "@/lib/mantenimientos/cola";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// GET /api/mantenimientos/jobs/[id] — detalle de un trabajo (404 fuera del alcance D-015).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const { id } = await ctx.params;
    const jobId = Number(id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      throw new AppError("El jobId es requerido y debe ser un número entero", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const job = await obtenerJob(jobId, u.identificacion ?? "", u.rolId ?? 0);
    return NextResponse.json(job);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
