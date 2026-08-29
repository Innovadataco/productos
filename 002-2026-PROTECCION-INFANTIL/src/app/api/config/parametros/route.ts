import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPageSize, clampPage } from "@/lib/pagination";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";

export async function GET(request: Request) {
    try {
        await assertModulo(await verifyAuth(RolUsuario.ADMIN), "configuracion_sistema");

        const { searchParams } = new URL(request.url);
        const categoria = searchParams.get("categoria");
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"));

        // SPEC-053: la consulta y el saneado de secretos viven en el DAL; la ruta no toca prisma.
        const resultado = await new ConfiguracionService().listar({ categoria, page, pageSize });

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
