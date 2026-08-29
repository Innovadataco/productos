import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { UsuariosConsolidadoService } from "@/lib/dal/services/usuarios-consolidado";

/**
 * GET /api/admin/usuarios/dashboard (SPEC-205, 002-PI-102)
 * KPI consolidado por rol + alertas derivadas.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "usuarios_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const servicio = new UsuariosConsolidadoService();
        const [kpi, alertas] = await Promise.all([servicio.resumenPorRol(), servicio.alertasDashboard()]);

        // La alerta visual de cada tarjeta se activa si hay una alerta del mismo dominio.
        const alertasDominio = new Set(alertas.map((a) => a.tipo));
        const kpiConAlerta = kpi.map((card) => ({
            ...card,
            alerta:
                (card.key === "operadores" && alertasDominio.has("operadores_sobrecargados")) ||
                (card.key === "comite" && alertasDominio.has("comite_sin_miembros")) ||
                (card.key === "rectores" && alertasDominio.has("colegio_sin_rector")),
        }));

        return NextResponse.json({ kpi: kpiConAlerta, alertas });
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
