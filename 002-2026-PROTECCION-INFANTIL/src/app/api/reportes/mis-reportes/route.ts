import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPageSize, clampPage } from "@/lib/pagination";
import { ReporteQueryService } from "@/lib/dal/services/reporte-query";

const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        // SPEC-119: un padre con el servicio vencido no consulta su área (datos intactos).
        const { assertVigenciaCliente } = await import("@/lib/colegio/vigencia");
        await assertVigenciaCliente(user.id);

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
