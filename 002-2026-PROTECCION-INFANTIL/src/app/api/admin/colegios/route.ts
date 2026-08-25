import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { adminColegioNuevoSchema } from "@/lib/validators";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const colegios = await new ColegioRepository().listarAdminGlobal();

        return NextResponse.json({ colegios });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COLEGIOS]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(adminColegioNuevoSchema)(request);
        const { nombreColegio, nombreRector, emailRector } = body;

        const resultado = await new RegistroColegioService().preRegistrarPorAdmin(
            nombreColegio,
            nombreRector,
            emailRector,
            admin.id
        );

        if (!resultado.ok) {
            const mensaje = resultado.tipo === "existente"
                ? "Ya existe un usuario con el email del rector"
                : "No se pudo resolver la ubicación por defecto del colegio";
            const codigo = resultado.tipo === "existente" ? ERROR_CODES.CONFLICT : ERROR_CODES.INTERNAL_ERROR;
            const status = resultado.tipo === "existente" ? 409 : 500;
            return NextResponse.json(
                { error: { message: mensaje, code: codigo } },
                { status }
            );
        }

        const { user, colegioId, colegioNombre } = resultado;
        const { ipAddress, userAgent } = getClientInfo(request);

        await logAudit({
            accion: "COLEGIO_CREADO",
            tipoRecurso: "Colegio",
            recursoId: colegioId,
            usuarioId: admin.id,
            colegioId,
            valorNuevo: JSON.stringify({
                nombre: colegioNombre,
                adminEmail: user.email,
                adminId: user.id,
                invitacion: true,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            colegio: {
                id: colegioId,
                nombre: colegioNombre,
                estado: "activo",
            },
            admin: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                estadoActivacion: "INVITADO",
            },
            mensaje: "Invitación enviada. El rector recibirá un email para activar su cuenta.",
        }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[ADMIN/COLEGIOS]");
    }
}
