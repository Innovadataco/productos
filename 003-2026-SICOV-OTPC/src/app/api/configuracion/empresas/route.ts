import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { crearEmpresa, listarEmpresas } from "@/lib/configuracion/empresas";
import { AppError } from "@/lib/errors";

/// GET /api/configuracion/empresas — listado paginado (rol 1 + guard configuracion/empresas).
export async function GET(req: Request) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const { searchParams } = new URL(req.url);
    const r = await listarEmpresas(searchParams.get("page"), searchParams.get("pageSize"));
    return NextResponse.json(r);
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/// POST /api/configuracion/empresas — crea ProveedorVigilado + Usuario rol 2 + módulos + correo
/// (correo FUERA de la transacción). Rol 1 exclusivo.
export async function POST(req: Request) {
  try {
    const u = await verifyAuth([1]);
    await requiereModulo(u, "configuracion", "empresas");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = await crearEmpresa({
      empresa: String(body["empresa"] ?? ""),
      nit: String(body["nit"] ?? ""),
      correo: String(body["correo"] ?? ""),
      fechaInicial: (body["fechaInicial"] as string) ?? null,
      fechaFinal: (body["fechaFinal"] as string) ?? null,
      token: (body["token"] as string) ?? null,
      modulos: Array.isArray(body["modulos"]) ? (body["modulos"] as number[]) : [],
    });
    return NextResponse.json(r, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
