import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { obtenerConfigAsignacion } from "@/lib/operadores/asignador";
import { whereReporteEnEstado } from "@/lib/reportes-acceso";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

const reasignarSchema = z.object({
    operadorId: z.string().min(1),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "bandeja_reportes");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;

        const body = await request.json();
        const parsed = reasignarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "operadorId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // E-8: las lecturas/escrituras viven en los repos; la ruta no toca prisma.
        const reportes = new ReporteRepository();
        const reporte = await reportes.findPermisosGestionBasico(id);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.estado !== "REVISION_MANUAL") {
            return NextResponse.json(
                { error: { message: "Solo se pueden reasignar reportes en revisión manual", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const operador = await new UsuarioRepository().findOperadorActivoConCupo(parsed.data.operadorId);

        if (!operador || !operador.perfilOperador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado o inactivo", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const [casosAbiertos, config] = await Promise.all([
            reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { operadorId: operador.id })),
            obtenerConfigAsignacion(),
        ]);
        const cupoMaximo = operador.perfilOperador.cupoMaximo ?? config.cupoDefault;
        if (casosAbiertos >= cupoMaximo) {
            return NextResponse.json(
                { error: { message: "El operador seleccionado está al cupo máximo", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        await reportes.actualizarEstado(id, { operadorId: operador.id });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "OPERADOR_REASIGNADO",
            tipoRecurso: "Reporte",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ operadorId: reporte.operadorId }),
            valorNuevo: JSON.stringify({ operadorId: operador.id, operadorEmail: operador.email, operadorNombre: operador.nombre }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            reporteId: id,
            operadorId: operador.id,
            operadorEmail: operador.email,
            operadorNombre: operador.nombre,
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/REPORTES-REVISION]");
    }
}
