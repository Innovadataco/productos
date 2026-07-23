import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { envBool } from "@/lib/env";
import { inicioDiaBogota } from "@/lib/bogota";

/// Registra un despacho y lo encola (un solo POST). El worker table-driven lo reporta con doble token.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "salidas"); // D-017: el permiso por módulo se valida en la ruta, no solo en el menú
    const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      throw new AppError("Payload inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    for (const clave of ["obj_despacho", "obj_vehiculo", "obj_conductores", "obj_rutas"]) {
      if (!(clave in payload)) {
        throw new AppError(`Falta ${clave} en el payload`, ERROR_CODES.VALIDATION_ERROR, 400);
      }
    }

    // Resuelve y valida el contexto efectivo (herencia rol 3, token del vigilado presente).
    const identificacion = u.identificacion ?? "";
    const contexto = await resolverContextoEfectivo(identificacion, u.rolId ?? 0);

    // Validación de contrato del proveedor (opcional por flag; el legacy la aplica en otras rutas).
    if (envBool("VALIDAR_CONTRATO_DESPACHO", false)) {
      await validarContratoVigente(contexto.nitVigilado);
    }

    const solicitud = await prisma.despachoSolicitud.create({
      data: {
        payload: payload as object,
        nitVigilado: contexto.nitVigilado.slice(0, 20),
        usuarioId: identificacion.slice(0, 20),
        rolId: u.rolId ?? null,
        fuente: "WEB",
        estado: "pendiente",
        procesado: false,
        siguienteIntento: new Date(),
      },
    });

    return NextResponse.json(
      { solicitudId: solicitud.id, estado: solicitud.estado },
      { status: 202 },
    );
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// GET: listado paginado de solicitudes del vigilado (para el log de cola).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "salidas"); // D-017: el permiso por módulo se valida en la ruta, no solo en el menú
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));

    // Rol 1 (admin) ve todo; rol 2/3 solo su NIT efectivo.
    const nit =
      u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? "");
    const where = u.rolId === 1 ? {} : { nitVigilado: nit.slice(0, 20) };

    const [items, total] = await Promise.all([
      prisma.despachoSolicitud.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.despachoSolicitud.count({ where }),
    ]);

    // Además: KPI "despachos hoy" correcto (bug 5) por si el cliente lo consume aquí.
    const despachosHoy = await prisma.despachoSolicitud.count({
      where: { ...where, fechaCreacion: { gte: inicioDiaBogota() } },
    });

    return NextResponse.json({
      items,
      despachosHoy,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

async function validarContratoVigente(nitVigilado: string): Promise<void> {
  const hoy = new Date();
  const proveedor = await prisma.proveedorVigilado.findFirst({
    where: { documento: nitVigilado, estado: true },
  });
  if (
    !proveedor ||
    !proveedor.fechaInicial ||
    !proveedor.fechaFinal ||
    hoy < proveedor.fechaInicial ||
    hoy > proveedor.fechaFinal
  ) {
    throw new AppError("No tiene autorización, consulte con el vigilado", ERROR_CODES.FORBIDDEN, 401);
  }
}
