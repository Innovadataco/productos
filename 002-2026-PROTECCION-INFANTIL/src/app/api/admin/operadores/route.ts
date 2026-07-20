import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailBienvenidaOperador, enviarEmailBienvenidaComite } from "@/lib/email";
import { validarExclusividadRolComite, normalizarEsComiteParaRol } from "@/lib/operadores/permisos";
import { randomBytes } from "crypto";

const operadorSchema = z.object({
    email: z.string().email(),
    nombre: z.string().min(2).max(100),
    rol: z.enum(["OPERADOR", "COMITE_VALIDACION"]).default("OPERADOR"),
    cupoMaximo: z.coerce.number().int().min(1).max(200).optional(),
    esRevisorDeApelaciones: z.boolean().optional(),
    esComite: z.boolean().optional(),
    notasInternas: z.string().max(500).optional(),
});

function tempPassword() {
    return randomBytes(6).toString("hex");
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

function filtroTenant(admin: { rol: string; tenantId: string | null }) {
    if (admin.rol === "ADMIN") return {};
    return { tenantId: admin.tenantId ?? null };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const operadores = await prisma.usuario.findMany({
            where: { rol: { in: ["OPERADOR", "COMITE_VALIDACION"] }, ...filtroTenant(admin) },
            include: { perfilOperador: true },
            orderBy: { creadoEn: "desc" },
        });

        const conConteo = await Promise.all(
            operadores.map(async (op) => {
                const casosAbiertos = op.rol === "OPERADOR"
                    ? await prisma.reporte.count({
                          where: { operadorId: op.id, estado: "REVISION_MANUAL", eliminado: false },
                      })
                    : await prisma.solicitudComite.count({
                          where: { comiteId: op.id, estado: { in: ["PENDIENTE", "ASIGNADA"] } },
                      });
                const casosTotales = op.rol === "OPERADOR"
                    ? await prisma.reporte.count({
                          where: { operadorId: op.id, eliminado: false },
                      })
                    : await prisma.solicitudComite.count({
                          where: { comiteId: op.id },
                      });
                return {
                    id: op.id,
                    email: op.email,
                    nombre: op.nombre,
                    rol: op.rol,
                    estado: op.estado,
                    debeCambiarPassword: op.debeCambiarPassword,
                    tenantId: op.tenantId,
                    perfil: op.perfilOperador
                        ? {
                              cupoMaximo: op.perfilOperador.cupoMaximo,
                              esRevisorDeApelaciones: op.perfilOperador.esRevisorDeApelaciones,
                              esComite: op.perfilOperador.esComite,
                              notasInternas: op.perfilOperador.notasInternas,
                              creadoPorId: op.perfilOperador.creadoPorId,
                              ultimoEmailNotificacionEn: op.perfilOperador.ultimoEmailNotificacionEn,
                          }
                        : null,
                    casosAbiertos,
                    casosTotales,
                };
            })
        );

        return NextResponse.json({ operadores: conConteo });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
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

        const existe = await prisma.usuario.findUnique({ where: { email } });
        if (existe) {
            const mensajeBase = "Ya existe un usuario con ese email";
            const esRolGestionado = existe.rol === "OPERADOR" || existe.rol === "COMITE_VALIDACION";
            if (esRolGestionado && rol !== existe.rol) {
                const rolExistenteTexto = existe.rol === "OPERADOR" ? "operador" : "comité de validación";
                const rolNuevoTexto = rol === "OPERADOR" ? "operador" : "comité de validación";
                return NextResponse.json(
                    { error: { message: `No se puede crear un ${rolNuevoTexto} con el email de un ${rolExistenteTexto}.`, code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: { message: mensajeBase, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        const { ipAddress, userAgent } = getClientInfo(request);

        const operador = await prisma.usuario.create({
            data: {
                email,
                nombre,
                passwordHash,
                rol,
                estado: "activo",
                debeCambiarPassword: true,
                tenantId: admin.tenantId,
                perfilOperador: {
                    create: {
                        cupoMaximo: cupoMaximo ?? 10,
                        esRevisorDeApelaciones: esRevisorDeApelaciones ?? false,
                        esComite,
                        notasInternas,
                        creadoPorId: admin.id,
                    },
                },
            },
            include: { perfilOperador: true },
        });

        const accionAudit = rol === "COMITE_VALIDACION" ? "COMITE_CREADO" : "OPERADOR_CREADO";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: operador.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ email: operador.email, nombre: operador.nombre, rol: operador.rol, esComite }),
            ipAddress,
            userAgent,
        });

        const esComiteRol = rol === "COMITE_VALIDACION";
        const emailEnvio = esComiteRol ? enviarEmailBienvenidaComite : enviarEmailBienvenidaOperador;
        const rolTexto = esComiteRol ? "comité de validación" : "operador";

        let emailEnviado = false;
        try {
            await emailEnvio(operador.email, password);
            emailEnviado = true;
        } catch (err) {
            console.error(`[OPERADORES] Error enviando email de bienvenida a ${rolTexto}`, err);
        }

        return NextResponse.json({
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                rol: operador.rol,
                estado: operador.estado,
                debeCambiarPassword: operador.debeCambiarPassword,
                perfil: operador.perfilOperador,
            },
            passwordTemporal: password,
            emailEnviado,
            mensaje: emailEnviado
                ? `${rolTexto.charAt(0).toUpperCase() + rolTexto.slice(1)} creado. Se envió la contraseña temporal por email.`
                : `${rolTexto.charAt(0).toUpperCase() + rolTexto.slice(1)} creado. No se pudo enviar el email; copie la contraseña temporal que se muestra arriba.`,
        }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
