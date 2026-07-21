import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { limpiarPlaca } from "@/lib/normalizar";
import { fechaBogota } from "@/lib/bogota";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { SolicitudIntegradora } from "@/lib/integracion/integradora-tipos";

/// Consulta integradora (server-side, síncrona, solo lectura). Arma las 3 cabeceras (doble token).
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    const raw = (await req.json().catch(() => ({}))) as Partial<SolicitudIntegradora>;

    const placa = limpiarPlaca(raw.placa);
    const numeroIdentificacion1 = raw.numeroIdentificacion1?.toString().trim();
    const fechaConsulta = raw.fechaConsulta?.toString().trim();

    if (!placa) throw new AppError("Falta la placa", ERROR_CODES.VALIDATION_ERROR, 400);
    if (!numeroIdentificacion1) {
      throw new AppError("Falta numeroIdentificacion1", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!fechaConsulta) {
      throw new AppError("Falta fechaConsulta", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Si la fecha no es hoy (Bogota), se requiere hora (paridad legacy).
    if (fechaConsulta !== fechaBogota() && !raw.horaConsulta) {
      throw new AppError(
        "horaConsulta es requerida cuando la fecha no es hoy",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // NIT efectivo (herencia rol 3) si no viene en el body.
    const nitEfectivo =
      raw.nit?.toString().trim() ||
      (u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? ""));

    const body: SolicitudIntegradora = {
      placa,
      numeroIdentificacion1,
      numeroIdentificacion2: raw.numeroIdentificacion2?.toString().trim() || undefined,
      nit: nitEfectivo,
      fechaConsulta,
      horaConsulta: raw.horaConsulta?.toString().trim() || undefined,
    };

    const cliente = getClienteSupertransporte();
    const resumen = await cliente.consultarIntegradora(
      body,
      u.identificacion ?? "",
      u.rolId ?? 0,
    );
    return NextResponse.json(resumen);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    const e = err as { name?: string; status?: number };
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      return NextResponse.json({ error: "Tiempo de espera agotado", code: ERROR_CODES.UPSTREAM_ERROR }, { status: 504 });
    }
    if (typeof e?.status === "number" && e.status >= 500) {
      return NextResponse.json({ error: "Error de la integradora", code: ERROR_CODES.UPSTREAM_ERROR }, { status: 502 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
