import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { generarPlantillaPreventivoCorrectivo } from "@/lib/mantenimientos/excel";
import { AppError } from "@/lib/errors";
import { NextResponse } from "next/server";

/// GET /api/mantenimientos/plantillas/preventivo-correctivo — plantilla oficial server-side
/// (manual §10.10): hoja `mantenimiento` (10 columnas) + hoja `tipos_identificacion` (12 códigos).
export async function GET() {
  try {
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos");
    const buffer = await generarPlantillaPreventivoCorrectivo();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=plantilla_mantenimiento_preventivo_correctivo.xlsx",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
