import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { reintentarJob, type AccionReintento } from "@/lib/mantenimientos/cola";
import { AppError, ERROR_CODES } from "@/lib/errors";

const ACCIONES: ReadonlyArray<AccionReintento> = ["reprogramar", "actualizar", "marcarProcesado"];

/// POST /api/mantenimientos/jobs/[id]/reintentar — reintento manual (§10.6): NO es solo
/// reenviar; `actualizar` corrige payload y datos locales, resetea reintentos=0 y dispara un
/// ciclo completo nuevo. `reprogramar` (default) → 409 al máximo. Detalle con base fallido
/// opera sobre el base.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const { id } = await ctx.params;
    const jobId = Number(id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      throw new AppError("El jobId es requerido y debe ser un número entero", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accion = body["accion"];
    if (accion !== undefined && (typeof accion !== "string" || !ACCIONES.includes(accion as AccionReintento))) {
      throw new AppError("La acción indicada no es válida", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const payload = body["payload"];
    if (payload !== undefined && payload !== null && (typeof payload !== "object" || Array.isArray(payload))) {
      throw new AppError("El payload debe ser un objeto o nulo", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const r = await reintentarJob(jobId, u.identificacion ?? "", u.rolId ?? 0, {
      accion: accion as AccionReintento | undefined,
      payload: (payload ?? null) as Record<string, unknown> | null,
    });
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
