import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { getProyeccion, type HorizonteProyeccion } from "@/lib/bi/analitica";

// Proyección semanal con horizonte parametrizable (filtro 4/8/12 de la UI):
// Prisma en runtime Node, siempre dinámico — nada de esto corre en edge ni
// se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Horizonte cuando el parámetro falta (comportamiento histórico del v4). */
const HORIZONTE_DEFAULT: HorizonteProyeccion = 8;
const HORIZONTES_VALIDOS = new Set<number>([4, 8, 12]);

/**
 * GET /api/bi/analitica/proyeccion?semanas=4|8|12 — proyección de la próxima
 * semana con N semanas de historia (misma regresión de getAnalitica, horizonte
 * elegido por el usuario). Defensa en profundidad tras el middleware (SE2).
 *
 * 400 horizonte_invalido · `semanas` presente pero distinto de 4/8/12.
 *                          Ausente → default 8 (compatibilidad).
 * 200                    · ProyeccionSemanal ({ min, max, tendenciaSemanas,
 *                          hayBase }); min/max NULL si no hay base honesta.
 */
export async function GET(request: Request) {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    const crudo = new URL(request.url).searchParams.get("semanas");
    const semanas = crudo === null ? HORIZONTE_DEFAULT : Number(crudo);
    if (!HORIZONTES_VALIDOS.has(semanas)) {
        return NextResponse.json({ error: "horizonte_invalido" }, { status: 400 });
    }

    const proyeccion = await getProyeccion(semanas as HorizonteProyeccion);
    return NextResponse.json(proyeccion, { status: 200 });
}
