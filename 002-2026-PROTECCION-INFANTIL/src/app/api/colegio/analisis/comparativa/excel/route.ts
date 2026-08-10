import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { calcularComparativaCursos } from "@/lib/colegio/comparativa";
import { generarExcelComparativa } from "@/lib/colegio/export-comparativa-excel";
import { comparativaQuerySchema } from "@/lib/schemas/comparativa";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const runtime = "nodejs";

function slugify(nombre: string): string {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");

        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const queryParse = comparativaQuerySchema.safeParse({
            agruparPor: searchParams.get("agruparPor") ?? undefined,
        });
        if (!queryParse.success) {
            return NextResponse.json(
                { error: { message: "Criterio de agrupación inválido. Use 'grado' o 'anioLectivo'.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const datos = await calcularComparativaCursos(user.colegioId, queryParse.data.agruparPor);
        const buffer = await generarExcelComparativa(datos);

        await logAudit({
            accion: "COLEGIO_COMPARATIVA_EXCEL_DESCARGADO",
            tipoRecurso: "ComparativaCursos",
            usuarioId: user.id,
            colegioId: user.colegioId,
            valorNuevo: JSON.stringify({ agruparPor: queryParse.data.agruparPor, bytes: buffer.byteLength }),
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
        });

        const filename = `comparativa-cursos-${slugify(datos.colegioNombre)}-${queryParse.data.agruparPor}.xlsx`;
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
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
