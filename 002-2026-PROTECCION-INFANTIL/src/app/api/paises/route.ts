import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import { PaisRepository } from "@/lib/dal/repositories/pais";

const CLAVE_PAISES_REPORTE = "geo.paises_reporte";

const querySchema = z.object({
    // SPEC-580: el filtro por países aplica SOLO al contexto del formulario de
    // reporte; los demás consumidores (registro de colegio, perfiles) no lo envían
    // y siguen recibiendo todos los activos.
    contexto: z.enum(["reporte"]).optional(),
});

/**
 * GET /api/paises[?contexto=reporte]
 *
 * SPEC-580: con `contexto=reporte` se filtra por los códigos ISO del parámetro
 * `geo.paises_reporte` (vacío o inexistente = todos los activos). Fallo al leer
 * el parámetro: fail-open con log, se sirven todos los activos (patrón del repo).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
        contexto: searchParams.get("contexto") ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json(
            { error: { message: "Parámetro contexto inválido", code: ERROR_CODES.VALIDATION_ERROR } },
            { status: 400 }
        );
    }

    let codigosReporte: string[] | null = null;
    if (parsed.data.contexto === "reporte") {
        try {
            const valor = await getParametroSistemaValor(CLAVE_PAISES_REPORTE);
            if (valor) {
                const codigos = valor.split(",").map((c) => c.trim()).filter(Boolean);
                if (codigos.length > 0) codigosReporte = codigos;
            }
        } catch (error) {
            logger.error("[Paises] Error leyendo geo.paises_reporte; se sirven todos los activos —", error);
        }
    }

    // E-8: la consulta vive en el repo; la ruta no toca prisma.
    const paises = await new PaisRepository().listarActivos(codigosReporte ?? undefined);

    return NextResponse.json({ paises });
}
