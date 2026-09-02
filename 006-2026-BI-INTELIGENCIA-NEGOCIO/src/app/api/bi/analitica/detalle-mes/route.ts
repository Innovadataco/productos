import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { getDetalleMes, MES_REGEX } from "@/lib/bi/analitica";

// Drill-down de la timeline interactiva (BI v2): Prisma en runtime Node,
// siempre dinámico — nada de esto corre en edge ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bi/analitica/detalle-mes?mes=YYYY-MM — detalle REAL de un mes de
 * la cronología (total, categoría top, alertas/escaladas, anónimos y
 * fenómenos detectados en ese mes). Defensa en profundidad tras el
 * middleware (fail-closed, SE2).
 *
 * 400 formato_invalido · mes que no es 'YYYY-MM' (mes 01..12).
 * 404 sin_datos        · mes válido pero sin reportes (nada honesto que
 *                        contar; candado 9).
 * 200                  · DetalleMes.
 */
export async function GET(request: Request) {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    const mes = new URL(request.url).searchParams.get("mes") ?? "";
    if (!MES_REGEX.test(mes)) {
        return NextResponse.json({ error: "formato_invalido" }, { status: 400 });
    }

    const detalle = await getDetalleMes(mes);
    if (!detalle) {
        return NextResponse.json({ error: "sin_datos" }, { status: 404 });
    }
    return NextResponse.json(detalle, { status: 200 });
}
