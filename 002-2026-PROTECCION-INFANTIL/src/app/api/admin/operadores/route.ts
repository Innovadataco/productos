import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { enviarEmailBienvenidaOperador, enviarEmailBienvenidaComite } from "@/lib/email";
import { validarExclusividadRolComite, normalizarEsComiteParaRol } from "@/lib/operadores/permisos";
import { OperadorService } from "@/lib/dal/services/operadores";

const operadorSchema = z.object({
    email: z.string().email(),
    nombre: z.string().min(2).max(100),
    rol: z.enum(["OPERADOR", "COMITE_VALIDACION"]).default("OPERADOR"),
    cupoMaximo: z.coerce.number().int().min(1).max(200).optional(),
    esRevisorDeApelaciones: z.boolean().optional(),
    esComite: z.boolean().optional(),
    notasInternas: z.string().max(500).optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // SPEC-053: la consulta y los conteos viven en el DAL; la ruta no toca prisma.
        const operadores = await new OperadorService().listar(admin);

        return NextResponse.json({ operadores });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const body = await request.json();
        const parsed = operadorSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { rol, esRevisorDeApelaciones, notasInternas, cupoMaximo, email, nombre, esComite: esComiteInput } = parsed.data;
        const esComite = esComiteInput ?? normalizarEsComiteParaRol(rol);

        try {
            validarExclusividadRolComite({ rol, esComite });
        } catch (err) {
            if (err instanceof Error && "code" in err && typeof err.code === "string") {
                return NextResponse.json({ error: { message: safeErrorMessage(err), code: err.code } }, { status: 400 });
            }
            throw err;
        }

        // SPEC-053: unicidad, alta con perfil y password temporal viven en el DAL;
        // la ruta no toca prisma.
        const service = new OperadorService();
        const resultado = await service.crear(
            { email, nombre, rol, cupoMaximo, esRevisorDeApelaciones, esComite, notasInternas },
            { id: admin.id, tenantId: admin.tenantId }
        );

        if (!resultado.ok) {
            if (resultado.tipo === "rol_distinto") {
                const rolExistenteTexto = resultado.rolExistente === "OPERADOR" ? "operador" : "comité de validación";
                const rolNuevoTexto = resultado.rolNuevo === "OPERADOR" ? "operador" : "comité de validación";
                return NextResponse.json(
                    { error: { message: `No se puede crear un ${rolNuevoTexto} con el email de un ${rolExistenteTexto}.`, code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: { message: "Ya existe un usuario con ese email", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const { operador, password, accionAudit } = resultado;

        await service.auditarAlta({
            accion: accionAudit,
            operadorId: operador.id,
            adminId: admin.id,
            valorNuevo: JSON.stringify({ email: operador.email, nombre: operador.nombre, rol: operador.rol, esComite }),
            info: getClientInfo(request),
        });

        const esComiteRol = rol === "COMITE_VALIDACION";
        const emailEnvio = esComiteRol ? enviarEmailBienvenidaComite : enviarEmailBienvenidaOperador;
        const rolTexto = esComiteRol ? "comité de validación" : "operador";

        let emailEnviado = false;
        try {
            await emailEnvio(operador.email, password!);
            emailEnviado = true;
        } catch (err) {
            logger.error(`[OPERADORES] Error enviando email de bienvenida a ${rolTexto}`, err);
        }

        return NextResponse.json({
            operador,
            passwordTemporal: password,
            emailEnviado,
            mensaje: emailEnviado
                ? `${rolTexto.charAt(0).toUpperCase() + rolTexto.slice(1)} creado. Se envió la contraseña temporal por email.`
                : `${rolTexto.charAt(0).toUpperCase() + rolTexto.slice(1)} creado. No se pudo enviar el email; copie la contraseña temporal que se muestra arriba.`,
        }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES]");
    }
}
