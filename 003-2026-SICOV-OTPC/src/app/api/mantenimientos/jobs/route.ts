import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { listarJobs } from "@/lib/mantenimientos/cola";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// GET /api/mantenimientos/jobs — trabajos programados, paginado server-side con filtros.
/// Alcance D-015: roles 2/3 atados a su NIT efectivo (rol 3 = NIT del admin) IGNORANDO cualquier
/// `nit` del cliente; rol 1 ve todas las empresas (desviación deliberada aprobada por el CEO).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1, 2, 3]);
    await requiereModulo(u, "mantenimientos");
    const q = new URL(req.url).searchParams;

    let pagina: number | undefined;
    if (q.get("pagina") !== null) {
      pagina = Number(q.get("pagina"));
      if (!Number.isInteger(pagina) || pagina < 1) {
        throw new AppError("La página debe ser un número entero mayor o igual a 1", ERROR_CODES.VALIDATION_ERROR, 400);
      }
    }
    let limite: number | undefined;
    if (q.get("limite") !== null) {
      limite = Number(q.get("limite"));
      if (!Number.isInteger(limite) || limite < 1) {
        throw new AppError("El límite debe ser un número entero mayor o igual a 1", ERROR_CODES.VALIDATION_ERROR, 400);
      }
    }
    const fecha = q.get("fecha");
    if (fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new AppError("La fecha debe tener formato ISO (YYYY-MM-DD)", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const dir = q.get("ordenDireccion");
    if (dir !== null && dir !== "asc" && dir !== "desc") {
      throw new AppError("La dirección de orden solo admite los valores asc o desc", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const r = await listarJobs(u.identificacion ?? "", u.rolId ?? 0, {
      estado: q.get("estado"),
      tipo: q.get("tipo"),
      placa: q.get("placa"),
      nit: q.get("nit"),
      fecha,
      termino: q.get("termino"),
      pagina,
      limite,
      ordenCampo: q.get("ordenCampo"),
      ordenDireccion: (dir as "asc" | "desc" | null) ?? undefined,
    });
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
