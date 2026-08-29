/**
 * SPEC-217 (002-PI-117): servicio del freemium del módulo de pagos.
 *
 * - `crearSuscripcionCliente`: servicio compartido de creación de `Suscripcion`
 *   (Deuda técnica 4 de la spec: hoy no existe otro flujo de creación en
 *   producción; este servicio ES el punto de entrada canónico para el registro
 *   de cliente y la creación admin). Activa el freemium cuando
 *   `pagos.freemium.activo=true` y el titular no tiene freemium histórico
 *   (FR-001/FR-004); asigna el plan básico `MES_1` del año Bogotá (FR-002) y
 *   calcula `freemiumFechaFin` en día calendario Bogotá (FR-003). Si el
 *   freemium no aplica, la suscripción nace `SUSPENDIDA` (estado que requiere
 *   pago, AS-003). El código de referido propio se genera aquí (hook de
 *   SPEC-215; el orden de hooks no afecta, Assumption 3).
 * - `extenderVigenciaDesdeFreemium`: hook del evento interno `pago.autorizado`
 *   (lo invoca el endpoint admin de autorización de pagos, SPEC-212). Convierte
 *   el freemium: `esFreemium=false` y `fechaFin = max(freemiumFechaFin, hoy
 *   Bogotá) + duracionCubierta` (FR-005); si el worker ya la había suspendido,
 *   el pago la reactiva a `ACTIVA`.
 *
 * FR-009: AuditLog en la activación (`SUSCRIPCION_FREEMIUM_ACTIVADA`) y en la
 * conversión (`SUSCRIPCION_FREEMIUM_CONVERTIDA`); la transición a SUSPENDIDA
 * por vencimiento la audita el worker de vigencia (SPEC-213).
 * FR-010: toda la persistencia pasa por repositorios DAL
 * (`PagosFreemiumRepository`; `PagosRepository` solo para la unicidad del
 * código de referido vía `generarCodigoReferidoUnico`).
 */
import type { Prisma, DuracionPlan, TipoTitular } from "@prisma/client";
import { EstadoSuscripcion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosFreemiumRepository } from "@/lib/dal/repositories/pagos-freemium-repository";
import { generarCodigoReferidoUnico } from "./referido.service";
import { esFreemiumActivo, obtenerDuracionFreemiumDias } from "./parametros-pagos";
import { anioBogota } from "./renovacion-calculos";
import { calcularFechaFinTrasPagoFreemium, calcularFreemiumFechaFin } from "./freemium-calculos";

export interface CrearSuscripcionClienteInput {
    tipoTitular: TipoTitular;
    colegioId?: string | undefined;
    usuarioId?: string | undefined;
    monedaLocal?: string | undefined;
    paisCliente?: string | undefined;
    /** Actor del AuditLog (admin que crea o el propio usuario que se registra). */
    actorUsuarioId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface CrearSuscripcionClienteResultado {
    suscripcionId: string;
    estado: EstadoSuscripcion;
    esFreemium: boolean;
    freemiumFechaFin: Date | null;
}

/**
 * Crea la `Suscripcion` de un nuevo cliente aplicando las reglas de freemium.
 * Contrato: `contracts/217-freemium.md` (flujo interno de creación).
 */
export async function crearSuscripcionCliente(
    input: CrearSuscripcionClienteInput
): Promise<CrearSuscripcionClienteResultado> {
    const repo = new PagosFreemiumRepository();
    const anio = anioBogota();

    // FR-002: el plan básico es el MES_1 del año actual. Sin plan de referencia
    // no se puede crear la suscripción (planActualId es obligatorio).
    const planBasico = await repo.obtenerPlanBasico(input.tipoTitular, anio);
    if (!planBasico) {
        console.error(
            `[Freemium] Activación: sin plan básico MES_1 activo para ${input.tipoTitular}/${anio} — suscripción no creada`
        );
        throw new AppError(
            "No hay un plan básico configurado para este tipo de cliente",
            ERROR_CODES.INTERNAL_ERROR,
            500
        );
    }

    const codigoReferidoPropio = await generarCodigoReferidoUnico(input.tipoTitular);
    const ahora = new Date();

    const activo = await esFreemiumActivo();
    const historico = activo
        ? await repo.tieneFreemiumHistorico({ usuarioId: input.usuarioId, colegioId: input.colegioId })
        : false;
    const activarFreemium = activo && !historico;

    const base = {
        tipoTitular: input.tipoTitular,
        planActualId: planBasico.id,
        codigoReferidoPropio,
        fechaInicio: ahora,
        monedaLocal: input.monedaLocal ?? "COP",
        paisCliente: input.paisCliente ?? "CO",
        ...(input.colegioId ? { colegioId: input.colegioId } : {}),
        ...(input.usuarioId ? { usuarioId: input.usuarioId } : {}),
    };

    let data: Prisma.SuscripcionUncheckedCreateInput;
    let freemiumFechaFin: Date | null = null;
    if (activarFreemium) {
        const duracionDias = await obtenerDuracionFreemiumDias();
        freemiumFechaFin = calcularFreemiumFechaFin(ahora, duracionDias);
        data = {
            ...base,
            estado: EstadoSuscripcion.ACTIVA,
            esFreemium: true,
            freemiumFechaFin,
            fechaFin: freemiumFechaFin,
        };
    } else {
        // AS-003: sin freemium (param apagado o histórico) la suscripción nace
        // en un estado que requiere pago, sin vigencia.
        data = {
            ...base,
            estado: EstadoSuscripcion.SUSPENDIDA,
            esFreemium: false,
            fechaFin: ahora,
            suspendidaEn: ahora,
        };
    }

    const suscripcion = await repo.crearSuscripcion(data);

    if (activarFreemium) {
        await logAudit({
            accion: "SUSCRIPCION_FREEMIUM_ACTIVADA",
            tipoRecurso: "Suscripcion",
            recursoId: suscripcion.id,
            usuarioId: input.actorUsuarioId,
            colegioId: input.colegioId ?? undefined,
            valorNuevo: JSON.stringify({
                suscripcionId: suscripcion.id,
                tipoTitular: input.tipoTitular,
                planBasicoId: planBasico.id,
                freemiumFechaFin: freemiumFechaFin?.toISOString(),
            }),
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        console.warn(
            `[Freemium] Activación: ${suscripcion.id} — ACTIVA freemium hasta ${freemiumFechaFin?.toISOString() ?? "?"}`
        );
    } else if (activo && historico) {
        console.warn(`[Freemium] Activación omitida: ${suscripcion.id} — titular con freemium histórico`);
    } else {
        console.warn(`[Freemium] Activación omitida: ${suscripcion.id} — pagos.freemium.activo=false`);
    }

    return {
        suscripcionId: suscripcion.id,
        estado: suscripcion.estado,
        esFreemium: suscripcion.esFreemium,
        freemiumFechaFin: suscripcion.freemiumFechaFin,
    };
}

export interface ExtenderVigenciaFreemiumInput {
    suscripcionId: string;
    duracionCubierta: DuracionPlan;
    actorAdminId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface ExtenderVigenciaFreemiumResultado {
    suscripcionId: string;
    fechaFin: Date;
    reactivada: boolean;
}

/**
 * Hook `pago.autorizado` sobre una suscripción freemium (FR-005, contrato
 * "autorización de pago durante freemium"). Devuelve null cuando la suscripción
 * no existe o no está en freemium (el pago sigue el flujo normal de SPEC-212).
 */
export async function extenderVigenciaDesdeFreemium(
    input: ExtenderVigenciaFreemiumInput
): Promise<ExtenderVigenciaFreemiumResultado | null> {
    const repo = new PagosFreemiumRepository();
    const suscripcion = await repo.obtenerSuscripcionFreemiumPorId(input.suscripcionId);
    if (!suscripcion || !suscripcion.esFreemium || !suscripcion.freemiumFechaFin) return null;

    const ahora = new Date();
    const nuevaFechaFin = calcularFechaFinTrasPagoFreemium({
        freemiumFechaFin: suscripcion.freemiumFechaFin,
        ahora,
        duracionCubierta: input.duracionCubierta,
    });

    // `freemiumFechaFin` se conserva: es la marca de histórico del anti-doble
    // freemium (FR-004).
    const data: Prisma.SuscripcionUncheckedUpdateInput = {
        esFreemium: false,
        fechaFin: nuevaFechaFin,
        fechaCorteProgramado: null,
    };
    // Si el worker ya la suspendió por freemium vencido, el pago la reactiva
    // (transición manual SUSPENDIDA → ACTIVA de SPEC-212).
    const reactivada = suscripcion.estado === EstadoSuscripcion.SUSPENDIDA;
    if (reactivada) {
        data.estado = EstadoSuscripcion.ACTIVA;
        data.suspendidaEn = null;
    }

    await repo.actualizarSuscripcion(suscripcion.id, data);

    await logAudit({
        accion: "SUSCRIPCION_FREEMIUM_CONVERTIDA",
        tipoRecurso: "Suscripcion",
        recursoId: suscripcion.id,
        usuarioId: input.actorAdminId,
        colegioId: suscripcion.colegioId ?? undefined,
        valorAnterior: JSON.stringify({
            esFreemium: true,
            estado: suscripcion.estado,
            fechaFin: suscripcion.fechaFin.toISOString(),
        }),
        valorNuevo: JSON.stringify({
            esFreemium: false,
            estado: data.estado ?? suscripcion.estado,
            fechaFin: nuevaFechaFin.toISOString(),
            duracionCubierta: input.duracionCubierta,
            reactivada,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });
    console.warn(
        `[Freemium] Pago durante freemium: ${suscripcion.id} — esFreemium=false, fechaFin=${nuevaFechaFin.toISOString()}`
    );

    return { suscripcionId: suscripcion.id, fechaFin: nuevaFechaFin, reactivada };
}
