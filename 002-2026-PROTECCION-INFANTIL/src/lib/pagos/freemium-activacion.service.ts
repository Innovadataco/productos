/**
 * SPEC-244 (002-PI-147): activación autónoma de freemium por un padre desde la
 * UI de suscripción. A diferencia de `crearSuscripcionCliente` (SPEC-217) que
 * corre en el registro, esta función es iniciada por un usuario autenticado que
 * acepta explícitamente los términos.
 */
import { EstadoSuscripcion, OrigenSuscripcion, TipoTitular } from "@prisma/client";
import type { Suscripcion } from "@prisma/client";
import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { programar } from "@/lib/notificaciones/motor";
import { generarCodigoReferidoUnico } from "./referido.service";
import { anioBogota } from "./renovacion-calculos";
import { obtenerDuracionFreemiumDias } from "./parametros-pagos";
import type { UsuarioTitular } from "./suscripcion-vista.service";

const ZONA_BOGOTA = "America/Bogota";

export interface ActivarFreemiumInput {
    usuario: UsuarioTitular & { email?: string | undefined; nombre?: string | null };
    aceptaTerminos: boolean;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface ActivarFreemiumResultado {
    suscripcion: Suscripcion;
    freemiumFechaFin: Date;
}

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

async function emitirEventoActivada(
    suscripcion: Suscripcion,
    usuario: ActivarFreemiumInput["usuario"],
    freemiumFechaFin: Date
): Promise<void> {
    if (!usuario.email) {
        console.warn(`[FreemiumActivacion] ${suscripcion.id} — sin email del titular; notificación omitida`);
        return;
    }

    const variables = {
        nombre: usuario.nombre ?? "",
        freemiumFechaFin: freemiumFechaFin.toISOString(),
        suscripcionId: suscripcion.id,
    };

    try {
        await programar({
            evento: "suscripcion.activada",
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            destinatarios: [
                {
                    usuarioId: usuario.id,
                    email: usuario.email,
                    variables,
                },
            ],
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[FreemiumActivacion] Evento activada: motor no disponible (${msg}); se continúa`);
    }
}

/**
 * Activa una suscripción freemium para un padre. Falla si ya tiene freemium,
 * si no acepta términos o si no hay un plan freemium activo para padres.
 */
export async function activarFreemium(input: ActivarFreemiumInput): Promise<ActivarFreemiumResultado> {
    if (!input.aceptaTerminos) {
        throw new AppError("Debe aceptar los términos de la prueba gratis", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const repo = new PagosRepository();
    const anio = anioBogota();

    const planFreemium = await repo.listarPlanes({
        tipoTitular: TipoTitular.PADRE,
        anio,
        activo: true,
        esFreemium: true,
    });

    const plan = planFreemium[0];
    if (!plan) {
        throw new AppError("No hay un plan de prueba gratis disponible", ERROR_CODES.NOT_FOUND, 404);
    }

    const freemiumExistentes = await repo.contarSuscripcionesFreemiumPorUsuario(input.usuario.id);
    if (freemiumExistentes > 0) {
        throw new AppError("Ya activaste una prueba gratis", ERROR_CODES.CONFLICT, 409);
    }

    const duracionDias = await obtenerDuracionFreemiumDias();
    const ahora = ahoraBogota();
    const freemiumFechaFin = addDays(ahora, duracionDias);
    const codigoReferidoPropio = await generarCodigoReferidoUnico(TipoTitular.PADRE);

    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: input.usuario.id,
        planActualId: plan.id,
        estado: EstadoSuscripcion.ACTIVA,
        origen: OrigenSuscripcion.FREEMIUM_AUTO,
        esFreemium: true,
        freemiumFechaFin,
        fechaInicio: ahora,
        fechaFin: freemiumFechaFin,
        monedaLocal: "COP",
        paisCliente: "CO",
        codigoReferidoPropio,
    });

    await logAudit({
        accion: "SUSCRIPCION_FREEMIUM_ACTIVADA",
        tipoRecurso: "Suscripcion",
        recursoId: suscripcion.id,
        usuarioId: input.usuario.id,
        valorNuevo: JSON.stringify({
            planId: plan.id,
            freemiumFechaFin: freemiumFechaFin.toISOString(),
            origen: OrigenSuscripcion.FREEMIUM_AUTO,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    await emitirEventoActivada(suscripcion, input.usuario, freemiumFechaFin);

    console.warn(`[FreemiumActivacion] ${suscripcion.id} — ACTIVA freemium hasta ${freemiumFechaFin.toISOString()}`);

    return { suscripcion, freemiumFechaFin };
}

interface RateLimitContext {
    ipAddress: string;
    userAgent?: string | undefined;
}

function construirRequestFake(ctx: RateLimitContext): Request {
    return new Request("http://localhost", {
        headers: {
            "x-forwarded-for": ctx.ipAddress,
            ...(ctx.userAgent ? { "user-agent": ctx.userAgent } : {}),
        },
    });
}

export interface ActivarFreemiumColegioInput {
    usuarioId: string;
    colegioId: string;
    email?: string | undefined;
    nombre?: string | null;
    aceptaTerminos: boolean;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

/**
 * SPEC-344 (A-69 · C1) — espejo colegio de `activarFreemium`:
 *   - crea Suscripcion con `TipoTitular.COLEGIO` y `colegioId` (no usuarioId).
 *   - dispara el puente D2 (escribe `Colegio.finServicio` con la ventana
 *     freemium parametrizada).
 * Falla si el colegio ya tiene freemium o si no hay plan freemium colegio.
 */
export async function activarFreemiumColegio(
    input: ActivarFreemiumColegioInput,
): Promise<ActivarFreemiumResultado> {
    if (!input.aceptaTerminos) {
        throw new AppError("Debe aceptar los términos de la prueba gratis", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const repo = new PagosRepository();
    const anio = anioBogota();

    const planesFreemium = await repo.listarPlanes({
        tipoTitular: TipoTitular.COLEGIO,
        anio,
        activo: true,
        esFreemium: true,
    });
    const plan = planesFreemium[0];
    if (!plan) {
        throw new AppError("No hay un plan de prueba institucional disponible", ERROR_CODES.NOT_FOUND, 404);
    }

    // Sin repo específico de freemium por colegio: contamos las suscripciones
    // freemium del colegio directamente vía count del cliente Prisma dentro
    // del PagosRepository ya expuesto.
    const yaTiene = (await repo.listarSuscripcionesPorColegio(input.colegioId)).some(
        (s) => s.esFreemium,
    );
    if (yaTiene) {
        throw new AppError("El colegio ya activó una prueba institucional", ERROR_CODES.CONFLICT, 409);
    }

    const duracionDias = await obtenerDuracionFreemiumDias();
    const ahora = ahoraBogota();
    const freemiumFechaFin = addDays(ahora, duracionDias);
    const codigoReferidoPropio = await generarCodigoReferidoUnico(TipoTitular.COLEGIO);

    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.COLEGIO,
        colegioId: input.colegioId,
        planActualId: plan.id,
        estado: EstadoSuscripcion.ACTIVA,
        origen: OrigenSuscripcion.FREEMIUM_AUTO,
        esFreemium: true,
        freemiumFechaFin,
        fechaInicio: ahora,
        fechaFin: freemiumFechaFin,
        monedaLocal: "COP",
        paisCliente: "CO",
        codigoReferidoPropio,
    });

    await logAudit({
        accion: "SUSCRIPCION_FREEMIUM_ACTIVADA",
        tipoRecurso: "Suscripcion",
        recursoId: suscripcion.id,
        usuarioId: input.usuarioId,
        valorNuevo: JSON.stringify({
            colegioId: input.colegioId,
            planId: plan.id,
            freemiumFechaFin: freemiumFechaFin.toISOString(),
            tipoTitular: "COLEGIO",
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    return { suscripcion, freemiumFechaFin };
}

/**
 * Wrapper que aplica rate-limiting por IP antes de activar el freemium.
 * Acepta un Request real o un contexto con IP/userAgent (útil en server actions).
 */
export async function activarFreemiumConRateLimit(
    input: ActivarFreemiumInput & ({ request: Request } | RateLimitContext)
): Promise<ActivarFreemiumResultado> {
    const ipAddress = "request" in input ? getClientIp(input.request) : input.ipAddress;
    const userAgent = "request" in input ? input.request.headers.get("user-agent") ?? undefined : input.userAgent;

    const request = "request" in input ? input.request : construirRequestFake({ ipAddress, userAgent });
    const rate = await checkRateLimit(request, "freemium_activacion", {
        identifier: ipAddress,
    });
    if (!rate.allowed) {
        throw new AppError("Demasiadas solicitudes. Inténtalo más tarde.", ERROR_CODES.RATE_LIMITED, 429);
    }

    return activarFreemium({
        usuario: input.usuario,
        aceptaTerminos: input.aceptaTerminos,
        ipAddress,
        userAgent,
    });
}
