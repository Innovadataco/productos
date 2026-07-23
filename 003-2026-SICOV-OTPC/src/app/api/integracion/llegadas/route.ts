import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";
import { limpiarPlaca } from "@/lib/normalizar";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// Registra una llegada y la encola. El worker table-driven la reporta con doble token.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "llegadas"); // D-017: el permiso por módulo se valida en la ruta, no solo en el menú
    const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      throw new AppError("Payload inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const placa = limpiarPlaca(payload["placa"]);
    const tipoLlegada = Number(payload["idTipollegada"]);
    if (!placa) throw new AppError("Falta la placa", ERROR_CODES.VALIDATION_ERROR, 400);
    if (!Number.isFinite(tipoLlegada) || tipoLlegada <= 0) {
      throw new AppError("idTipollegada inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Regla del legacy: tipo 1 exige idDespacho; tipo 2 debe tener idDespacho nulo.
    const idDespachoRaw = payload["idDespacho"];
    let idDespacho: number | null = null;
    if (tipoLlegada === 1) {
      const n = Number(idDespachoRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new AppError(
          "idDespacho es requerido para llegadas tipo 1",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }
      idDespacho = n;
    } else if (idDespachoRaw !== undefined && idDespachoRaw !== null) {
      throw new AppError(
        "idDespacho debe ser null para llegadas tipo 2",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // Contexto efectivo (herencia rol 3): valida token del vigilado presente.
    const identificacion = u.identificacion ?? "";
    const contexto = await resolverContextoEfectivo(identificacion, u.rolId ?? 0);

    const solicitud = await prisma.llegadaSolicitud.create({
      data: {
        payload: payload as object,
        nitVigilado: contexto.nitVigilado.slice(0, 20),
        usuarioId: identificacion.slice(0, 20),
        rolId: u.rolId ?? null,
        fuente: "WEB",
        tipoLlegada,
        idDespacho,
        placa: placa.slice(0, 10),
        estado: "pendiente",
        procesado: false,
        siguienteIntento: new Date(),
      },
    });

    return NextResponse.json({ solicitudId: solicitud.id, estado: solicitud.estado }, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// Listado paginado server-side de llegadas del vigilado (rol 1 ve todo).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "llegadas"); // D-017: el permiso por módulo se valida en la ruta, no solo en el menú
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));

    const nit =
      u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? "");
    const where = u.rolId === 1 ? {} : { nitVigilado: nit.slice(0, 20) };

    const [items, total] = await Promise.all([
      prisma.llegadaSolicitud.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.llegadaSolicitud.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
