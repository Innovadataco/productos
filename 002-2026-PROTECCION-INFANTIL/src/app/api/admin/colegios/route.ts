import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { programar as programarNotificacion } from "@/lib/notificaciones";
import { withValidation } from "@/lib/validation";
import { colegioBodySchema } from "@/lib/schemas";
import { calcularFinServicio, esRangoServicioValido } from "@/lib/colegio/periodo";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { seedMateriasPorDefecto } from "@/lib/colegio/materias-seed";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PaisRepository } from "@/lib/dal/repositories/pais";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import { DepartamentoRepository } from "@/lib/dal/repositories/departamento";
import { OnboardingColegioRepository } from "@/lib/dal/repositories/onboarding-colegio";
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
    departamentoId?: string | undefined;
    ciudadId: string;
}) {
    // E-8: las lecturas del catálogo viven en los repos; la ruta no toca prisma.
    const [pais, ciudad] = await Promise.all([
        new PaisRepository().findById(data.paisId),
        new CiudadRepository().findById(data.ciudadId),
    ]);

    if (!pais) throw new AppError("País no encontrado", ERROR_CODES.NOT_FOUND, 404);
    if (!ciudad) throw new AppError("Ciudad no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (ciudad.paisId !== data.paisId) {
        throw new AppError("La ciudad no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (data.departamentoId) {
        const departamento = await new DepartamentoRepository().findById(data.departamentoId);
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

        // La fecha de fin se calcula en el servidor según el tipo de período;
        // solo con período LIBRE se acepta la fecha manual, siempre fin > inicio.
        const inicio = new Date(inicioServicio);
        const fin = tipoPeriodo === "LIBRE" ? new Date(finServicio) : calcularFinServicio(inicio, tipoPeriodo);
        if (!fin || !esRangoServicioValido(inicio, fin)) {
            throw new AppError(
                "La fecha de fin del servicio debe ser posterior a la fecha de inicio",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const existingUser = await new UsuarioRepository().findByEmail(adminEmail.toLowerCase());
        if (existingUser) {
            return NextResponse.json(
                { error: { message: "Ya existe un usuario con el email del administrador institucional", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        const { ipAddress, userAgent } = getClientInfo(request);

        // E-8: las escrituras viven en los repos dentro de la unidad de trabajo.
        const colegio = await withUnitOfWork(async (tx) => {
            const tenant = await new ColegioRepository(tx).crearTenantParaColegio(nombre);

            const creado = await new ColegioRepository(tx).crear({
                nombre,
                paisId,
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                ...(departamentoId !== undefined ? { departamentoId } : {}),
                ciudadId,
                ...(direccion !== undefined ? { direccion } : {}),
                representanteLegalNombre,
                representanteLegalIdentificacion,
                representanteLegalEmail,
                ...(representanteLegalTelefono !== undefined ? { representanteLegalTelefono } : {}),
                inicioServicio: inicio,
                finServicio: fin,
                tipoPeriodo,
                estado: "activo",
                tenantId: tenant.id,
            });

            // SPEC-162: catálogo inicial de materias para el colegio.
            await seedMateriasPorDefecto(tx, creado.id);

            const schoolAdmin = await new UsuarioRepository(tx).crear({
                email: adminEmail.toLowerCase(),
                nombre: adminNombre,
                passwordHash,
                rol: "SCHOOL_ADMIN",
                estado: "activo",
                debeCambiarPassword: true,
                tenantId: tenant.id,
                colegioId: creado.id,
            });

            // SPEC-169: cada colegio nuevo nace con onboarding activo.
            await new OnboardingColegioRepository(tx).crear({
                colegioId: creado.id,
                estado: "activo",
                pasoActual: 1,
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

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
        let emailEnviado = false;
        try {
            const resultado = await programarNotificacion({
                evento: "colegio.creado",
                sujetoTipo: "Colegio",
                sujetoId: colegio.id,
                destinatarios: [{
                    email: colegio.admin.email,
                    variables: {
                        nombreColegio: colegio.nombre,
                        emailAdmin: colegio.admin.email,
                        passwordTemporal: password,
                        urlLogin: `${baseUrl}/login`,
                    },
                }],
            });
            emailEnviado = resultado.programadas > 0;
        } catch (err) {
            logger.error("[COLEGIOS] Error enviando email de bienvenida institucional", err);
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
        return errorToResponse(error, "[ADMIN/COLEGIOS]");
    }
}
