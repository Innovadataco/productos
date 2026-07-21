import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { cargarModulos } from "@/lib/modulos";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const u = await verifyAuth();
    const modulos = await cargarModulos(u.id, u.rolId ?? null);
    return NextResponse.json({
      usuario: {
        id: u.id,
        nombre: u.nombre,
        usuario: u.usuario,
        rol: u.rolId,
        identificacion: u.identificacion,
      },
      rol: u.rolId,
      claveTemporal: u.claveTemporal === true,
      modulos,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      // 401 → el cliente redirige a /login; nunca muestra datos demo (bug 4).
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
