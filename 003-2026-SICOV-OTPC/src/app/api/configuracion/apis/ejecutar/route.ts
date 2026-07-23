import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { ejecutarOperacion } from "@/lib/consola-apis/ejecutar";
import { FASE_CONSOLA } from "@/lib/consola-apis/catalogo";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// POST /api/configuracion/apis/ejecutar — ejecuta contra el STUB y registra en bitácora (rol 1).
/// Doble candado: `body.real === true` responde 403 fijo mientras FASE_CONSOLA sea 1 (no hay código
/// de ejecución real detrás — solo la factory con gate). Cambiar la fase exige commit revisado.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "apis");
    const body = (await req.json().catch(() => ({}))) as { operacion?: string; payload?: Record<string, unknown>; real?: boolean };

    if (body.real === true && FASE_CONSOLA === 1) {
      throw new AppError("Ejecución real deshabilitada (Fase 2 — requiere habilitación del CEO)", ERROR_CODES.FORBIDDEN, 403);
    }

    const r = await ejecutarOperacion(String(body.operacion ?? ""), body.payload ?? {}, {
      id: u.id,
      rolId: u.rolId,
      identificacion: u.identificacion,
    });
    return NextResponse.json(r, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
