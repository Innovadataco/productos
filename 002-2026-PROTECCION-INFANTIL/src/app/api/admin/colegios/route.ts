import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { withValidation, ValidationError, formatZodError } from "@/lib/validation";
import { adminColegioNuevoSchema } from "@/lib/validators";
import { colegioBodySchema } from "@/lib/schemas";
import { calcularFinServicio, esRangoServicioValido } from "@/lib/colegio/periodo";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { seedMateriasPorDefecto } from "@/lib/colegio/materias-seed";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PaisRepository } from "@/lib/dal/repositories/pais";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import { DepartamentoRepository } from "@/lib/dal/repositories/departamento";
import { OnboardingColegioRepository } from "@/lib/dal/repositories/onboarding-colegio";
import { programar as programarNotificacion } from "@/lib/notificaciones";

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

/**
 * POST /api/admin/colegios soporta dos modos de creación:
 *
 * 1. Modo SPEC-240 (nuevo): payload mínimo de 3 campos
 *    { nombreColegio, nombreRector, emailRector }
 *    → pre-registra el colegio y envía invitación por email al rector.
 *
 * 2. Modo legacy (SPEC-114/133): payload completo con adminEmail, paisId, etc.
 *    → crea el colegio y el admin con contraseña temporal.
 *
 * Se detecta el modo por la presencia de `adminEmail` en el body.
 */
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

        const bodyRaw = await request.json().catch(() => undefined);
        const isLegacy =
            bodyRaw && typeof bodyRaw === "object" && !Array.isArray(bodyRaw) && "adminEmail" in bodyRaw;

        if (isLegacy) {
            return crearColegioLegacy(request, admin.id, bodyRaw);
        }

        const body = await withValidation.body(adminColegioNuevoSchema)(
            new Request(request.url, { method: "POST", body: JSON.stringify(bodyRaw), headers: request.headers })
        );
        const { nombreColegio, nombreRector, emailRector, nit } = body;

        const resultado = await new RegistroColegioService().preRegistrarPorAdmin(
            nombreColegio,
            nombreRector,
            emailRector,
            admin.id,
            nit
        );

        if (!resultado.ok) {
            // SPEC-320 (§2.2-bis): nit_existente → 409.
            const esConflicto = resultado.tipo === "existente" || resultado.tipo === "nit_existente";
            const mensaje = resultado.tipo === "existente"
                ? "Ya existe un usuario con el email del rector"
                : resultado.tipo === "nit_existente"
                    ? "Ya existe un colegio con ese NIT"
                    : "No se pudo resolver la ubicación por defecto del colegio";
            const codigo = esConflicto ? ERROR_CODES.CONFLICT : ERROR_CODES.INTERNAL_ERROR;
            const status = esConflicto ? 409 : 500;
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

async function crearColegioLegacy(request: Request, adminId: string, bodyRaw: unknown) {
    const parsed = colegioBodySchema.safeParse(bodyRaw);
    if (!parsed.success) {
        const error = new ValidationError("Datos inválidos", formatZodError(parsed.error));
        return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }

    const {
        nombre,
        nit,
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
    } = parsed.data;

    await validarUbicacion({ paisId, departamentoId, ciudadId });

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

    // SPEC-320 (§2.2-bis): NIT único global.
    const nitExistente = await new ColegioRepository().buscarPorNit(nit);
    if (nitExistente) {
        return NextResponse.json(
            { error: { message: "Ya existe un colegio con ese NIT", code: ERROR_CODES.CONFLICT } },
            { status: 409 }
        );
    }

    const password = tempPassword();
    const passwordHash = await hashPassword(password);
    const { ipAddress, userAgent } = getClientInfo(request);

    const colegio = await withUnitOfWork(async (tx) => {
        const tenant = await new ColegioRepository(tx).crearTenantParaColegio(nombre);

        const creado = await new ColegioRepository(tx).crear({
            nombre,
            nit, // SPEC-320 (§2.2-bis): NIT único global
            paisId,
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
        usuarioId: adminId,
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
}
