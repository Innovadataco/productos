import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailBienvenidaColegio } from "@/lib/email";
import { withValidation } from "@/lib/validation";
import { colegioBodySchema } from "@/lib/schemas";
import { randomBytes } from "crypto";

function tempPassword() {
    return randomBytes(6).toString("hex");
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function validarUbicacion(data: {
    paisId: string;
    departamentoId?: string;
    ciudadId: string;
}) {
    const [pais, ciudad] = await Promise.all([
        prisma.pais.findUnique({ where: { id: data.paisId } }),
        prisma.ciudad.findUnique({ where: { id: data.ciudadId } }),
    ]);

    if (!pais) throw new AppError("País no encontrado", ERROR_CODES.NOT_FOUND, 404);
    if (!ciudad) throw new AppError("Ciudad no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (ciudad.paisId !== data.paisId) {
        throw new AppError("La ciudad no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (data.departamentoId) {
        const departamento = await prisma.departamento.findUnique({
            where: { id: data.departamentoId },
        });
        if (!departamento) throw new AppError("Departamento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        if (departamento.paisId !== data.paisId) {
            throw new AppError("El departamento no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (ciudad.departamentoId && ciudad.departamentoId !== data.departamentoId) {
            throw new AppError("La ciudad no pertenece al departamento seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
    }
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const colegios = await prisma.colegio.findMany({
            where: { estado: { not: "eliminado" } },
            include: {
                pais: { select: { id: true, nombre: true } },
                departamento: { select: { id: true, nombre: true } },
                ciudad: { select: { id: true, nombre: true } },
                admin: { select: { id: true, email: true, nombre: true, estado: true } },
                tenant: { select: { id: true, nombre: true } },
            },
            orderBy: { creadoEn: "desc" },
        });

        return NextResponse.json({ colegios });
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

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(colegioBodySchema)(request);
        const {
            nombre,
            paisId,
            departamentoId,
            ciudadId,
            direccion,
            representanteLegalNombre,
            representanteLegalIdentificacion,
            representanteLegalEmail,
            representanteLegalTelefono,
            inicioServicio,
            finServicio,
            tipoPeriodo,
            adminEmail,
            adminNombre,
        } = body;

        await validarUbicacion({ paisId, departamentoId, ciudadId });

        const existingUser = await prisma.usuario.findUnique({ where: { email: adminEmail.toLowerCase() } });
        if (existingUser) {
            return NextResponse.json(
                { error: { message: "Ya existe un usuario con el email del administrador institucional", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        const { ipAddress, userAgent } = getClientInfo(request);

        const colegio = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { nombre: `Colegio: ${nombre}`, estado: "activo" },
            });

            const creado = await tx.colegio.create({
                data: {
                    nombre,
                    paisId,
                    departamentoId,
                    ciudadId,
                    direccion,
                    representanteLegalNombre,
                    representanteLegalIdentificacion,
                    representanteLegalEmail,
                    representanteLegalTelefono,
                    inicioServicio: new Date(inicioServicio),
                    finServicio: new Date(finServicio),
                    tipoPeriodo,
                    estado: "activo",
                    tenantId: tenant.id,
                },
            });

            const schoolAdmin = await tx.usuario.create({
                data: {
                    email: adminEmail.toLowerCase(),
                    nombre: adminNombre,
                    passwordHash,
                    rol: "SCHOOL_ADMIN",
                    estado: "activo",
                    debeCambiarPassword: true,
                    tenantId: tenant.id,
                    colegioId: creado.id,
                },
            });

            return { ...creado, admin: schoolAdmin, tenant };
        });

        await logAudit({
            accion: "COLEGIO_CREADO",
            tipoRecurso: "Colegio",
            recursoId: colegio.id,
            usuarioId: admin.id,
            colegioId: colegio.id,
            valorNuevo: JSON.stringify({
                nombre,
                paisId,
                departamentoId,
                ciudadId,
                representanteLegalNombre,
                representanteLegalEmail,
                adminEmail,
                adminId: colegio.admin.id,
                tenantId: colegio.tenant.id,
            }),
            ipAddress,
            userAgent,
        });

        let emailEnviado = false;
        try {
            await enviarEmailBienvenidaColegio(colegio.admin.email, password);
            emailEnviado = true;
        } catch (err) {
            console.error("[COLEGIOS] Error enviando email de bienvenida institucional", err);
        }

        return NextResponse.json({
            colegio: {
                id: colegio.id,
                nombre: colegio.nombre,
                paisId: colegio.paisId,
                departamentoId: colegio.departamentoId,
                ciudadId: colegio.ciudadId,
                direccion: colegio.direccion,
                representanteLegalNombre: colegio.representanteLegalNombre,
                representanteLegalIdentificacion: colegio.representanteLegalIdentificacion,
                representanteLegalEmail: colegio.representanteLegalEmail,
                representanteLegalTelefono: colegio.representanteLegalTelefono,
                inicioServicio: colegio.inicioServicio,
                finServicio: colegio.finServicio,
                tipoPeriodo: colegio.tipoPeriodo,
                estado: colegio.estado,
                admin: {
                    id: colegio.admin.id,
                    email: colegio.admin.email,
                    nombre: colegio.admin.nombre,
                    estado: colegio.admin.estado,
                    debeCambiarPassword: colegio.admin.debeCambiarPassword,
                },
                tenantId: colegio.tenant.id,
            },
            passwordTemporal: password,
            emailEnviado,
            mensaje: emailEnviado
                ? "Colegio creado. Se envió la contraseña temporal por email."
                : "Colegio creado. No se pudo enviar el email; copie la contraseña temporal que se muestra arriba.",
        }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
