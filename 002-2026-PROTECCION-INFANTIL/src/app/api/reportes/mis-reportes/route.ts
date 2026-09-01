import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPageSize, clampPage } from "@/lib/pagination";
import { ReporteQueryService } from "@/lib/dal/services/reporte-query";

const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        // SPEC-356 (I-253) · DEROGADO el guard de vigencia de SPEC-119 acá.
        // `guardias.ts` exime `/api/reportes` (y con él toda su familia, por
        // prefijo) de la vigencia con la regla dura de Jelkin. Un padre vencido
        // que no puede LEER sus propios reportes tampoco puede seguir el hilo
        // de lo que ya denunció — y la página `/mis-reportes` está exenta,
        // así que bloquear su API la dejaba vacía. NO reintroducir el guard.

        const { searchParams } = new URL(request.url);
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"), MAX_PAGE_SIZE);

        // SPEC-053: la consulta y el mapeo a DTOs viven en el DAL; la ruta no toca prisma.
        const resultado = await new ReporteQueryService().misReportes({ usuarioId: user.id, page, pageSize });

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
