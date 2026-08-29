import { NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { calcularAgregados } from "@/lib/cartera";
import { prisma } from "@/lib/prisma";

/**
 * Vista de cartera: todos los proyectos con sus agregados (spec 014, US1 / FR-002).
 *
 * Endpoint propio y no `GET /api/projects` porque el listado plano lo consumen
 * el tablero de fases y la página de proyectos, y cargarlo de agregados los
 * penalizaría. En Next.js el segmento estático `cartera` gana al dinámico
 * `[id]`, así que no colisionan.
 *
 * Los agregados se **derivan** al leer (`src/lib/cartera.ts`), no se persisten:
 * presupuesto, avance y riesgos abiertos cambian con cada mutación y un campo
 * guardado se desincronizaría.
 */
export async function GET() {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const proyectos = await prisma.proyecto.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        entregables: { select: { avance: true } },
        partidas: { select: { montoPlaneado: true } },
        riesgos: { select: { estado: true } },
      },
    });

    return NextResponse.json(proyectos.map(calcularAgregados));
  } catch (err: unknown) {
    return apiError("Proyectos", "GET cartera", "Error listando la cartera", 500, err);
  }
}
