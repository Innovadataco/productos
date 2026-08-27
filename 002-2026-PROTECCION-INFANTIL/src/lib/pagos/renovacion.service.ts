/**
 * SPEC-211 (002-PI-111): registro de una renovación de suscripción por parte
 * del cliente (rector/padre). Crea el `Pago` en PENDIENTE_AUTORIZACION con el
 * comprobante cifrado en disco, consume los bonos pre-aplicados y audita.
 *
 * La autorización del pago (extensión de vigencia) es de SPEC-212; la
 * notificación real al admin llegará con el motor de eventos (SPEC-213/217) —
 * aquí se emite un stub de dominio como hace SPEC-216 con `bono.aplicado`.
 */
import type { DuracionPlan, MetodoPago, Plan, Suscripcion } from "@prisma/client";
import { EstadoPago, EstadoSuscripcion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { aplicarBonoPromocional } from "./bono-aplicacion.service";
import { calcularMontoLocal } from "./tasas";
import { guardarComprobanteCifrado, validarComprobante } from "./comprobante-storage";
import {
    anioBogota,
    calcularDescuentoAnualUSD,
    resolverDescuentoTotal,
} from "./renovacion-calculos";
import {
    obtenerDescuentoAnualDefaultPct,
    obtenerDescuentoReferidoPct,
    obtenerLimitesComprobante,
} from "./parametros-pagos";
import { verificarTitularidad, type UsuarioTitular } from "./suscripcion-vista.service";

export interface RenovacionInput {
    suscripcionId: string;
    duracion: DuracionPlan;
    metodoDeclarado: MetodoPago;
    notas?: string | undefined;
    codigoReferido?: string | undefined;
    codigoBono?: string | undefined;
    comprobante: { buffer: Buffer; mimeType: string };
    usuario: UsuarioTitular;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface RenovacionResultado {
    pagoId: string;
    estado: EstadoPago;
    montoNetoUSD: number;
    montoLocalPagado: number;
    monedaLocal: string;
    comprobanteHashSha256: string;
}

/**
 * Stub del emisor de eventos de dominio (mismo patrón que SPEC-216). El motor
 * de notificaciones (SPEC-217) reemplazará este log por el aviso real al admin.
 */
export async function emitirEventoPagoReportado(payload: {
    pagoId: string;
    suscripcionId: string;
    montoNetoUSD: number;
    monedaLocal: string;
}): Promise<void> {
    // TODO(deuda técnica): conectar con motor de eventos cuando exista (SPEC-213/217).
    console.warn(`[PAGOS-EVENTO-STUB] pago.reportado: ${JSON.stringify(payload)}`);
}

async function obtenerSuscripcionRenovable(input: RenovacionInput, clienteRepo: PagosClienteRepository) {
    const suscripcion = await verificarTitularidad(input.suscripcionId, input.usuario);
    if (!suscripcion) {
        throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
    }
    if (suscripcion.estado !== EstadoSuscripcion.ACTIVA && suscripcion.estado !== EstadoSuscripcion.EN_GRACIA) {
        throw new AppError("La suscripción no está en un estado que permita renovar", ERROR_CODES.CONFLICT, 409);
    }
    if (await clienteRepo.obtenerPagoPendiente(suscripcion.id)) {
        throw new AppError("Ya existe un pago pendiente de autorización para esta suscripción", ERROR_CODES.CONFLICT, 409);
    }
    return suscripcion;
}

async function obtenerPlanRenovacion(
    repo: PagosRepository,
    suscripcion: Suscripcion,
    duracion: DuracionPlan
): Promise<Plan> {
    const plan = await repo.obtenerPlanPorClave(suscripcion.tipoTitular, duracion, anioBogota());
    if (!plan || !plan.activo) {
        throw new AppError("No hay un plan activo para la duración seleccionada", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    return plan;
}

async function validarComprobanteConParametros(comprobante: { buffer: Buffer; mimeType: string }): Promise<void> {
    const limites = await obtenerLimitesComprobante();
    const validacion = validarComprobante(comprobante.buffer, comprobante.mimeType, limites);
    if (!validacion.ok) {
        const esTamano = validacion.motivo?.includes("tamaño máximo") ?? false;
        throw new AppError(
            validacion.motivo ?? "Comprobante inválido",
            esTamano ? "PAYLOAD_TOO_LARGE" : ERROR_CODES.VALIDATION_ERROR,
            esTamano ? 413 : 400
        );
    }
}

/** Aplica el bono opcional por su nombre público (servicio de SPEC-216, con sus validaciones). */
async function aplicarBonoOpcional(
    repo: PagosRepository,
    suscripcion: Suscripcion,
    input: RenovacionInput,
    montoBaseUSD: number
): Promise<void> {
    if (!input.codigoBono) return;
    const bono = await repo.obtenerBonoPromocionalPorNombre(input.codigoBono.trim());
    if (!bono) {
        throw new AppError("Bono no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    await aplicarBonoPromocional({
        suscripcionId: suscripcion.id,
        bonoId: bono.id,
        montoBaseUSD,
        usuarioId: input.usuario.id,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });
}

/** Valida el código de referido opcional y calcula su descuento sobre la base. */
async function resolverReferido(
    clienteRepo: PagosClienteRepository,
    suscripcion: Suscripcion,
    codigoReferido: string | undefined,
    baseUSD: number
): Promise<{ codigo: string | undefined; descuentoUSD: number }> {
    const codigo = codigoReferido?.trim() || undefined;
    if (!codigo) return { codigo: undefined, descuentoUSD: 0 };
    if (codigo === suscripcion.codigoReferidoPropio) {
        throw new AppError("No puedes usar tu propio código de referido", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const referidor = await clienteRepo.buscarSuscripcionPorCodigoReferido(codigo);
    if (!referidor) {
        throw new AppError("Código de referido no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    const pct = await obtenerDescuentoReferidoPct();
    return { codigo, descuentoUSD: calcularDescuentoAnualUSD(baseUSD, pct) };
}

export async function registrarRenovacion(input: RenovacionInput): Promise<RenovacionResultado> {
    const { usuario } = input;
    const repo = new PagosRepository();
    const clienteRepo = new PagosClienteRepository();

    const suscripcion = await obtenerSuscripcionRenovable(input, clienteRepo);
    const plan = await obtenerPlanRenovacion(repo, suscripcion, input.duracion);
    await validarComprobanteConParametros(input.comprobante);

    // SPEC-289 (002-PI-189 · Fase 1): bifurcación por moneda de la suscripción.
    // Modo COP nativo: cero llamadas a TasaCambio; los bonos guardan valor
    // numérico en `BonoAplicado.descuentoUSD` (nombre legacy, valor COP).
    // Modo USD (histórico): flujo intacto, base→descuentos→conversión al local.
    const esCOP = suscripcion.monedaLocal === "COP";
    const descuentoAnualPct =
        input.duracion === "MES_12" ? plan.descuentoAnualPct ?? (await obtenerDescuentoAnualDefaultPct()) : 0;

    // Elegimos la unidad de trabajo: en modo COP la variable "base" es COP puro.
    const montoBase = esCOP ? plan.precioBaseCOP ?? 0 : plan.precioBaseUSD;
    const descuentoAnual = calcularDescuentoAnualUSD(montoBase, descuentoAnualPct);
    const baseTrasAnual = montoBase - descuentoAnual;

    await aplicarBonoOpcional(repo, suscripcion, input, baseTrasAnual);

    // Todos los bonos pre-aplicados (incluido el recién aplicado) se consumen en este pago.
    const bonosPendientes = await clienteRepo.listarBonosPendientesDePago(suscripcion.id);
    const descuentoBonos = bonosPendientes.reduce((acc, b) => acc + b.descuentoUSD, 0);
    const todosCombinables = bonosPendientes.every((b) => b.bono.combinableConCodigoPersonal);

    const referido = await resolverReferido(clienteRepo, suscripcion, input.codigoReferido, baseTrasAnual);

    const { descuentoTotalUSD: descuentoTotal, montoNetoUSD: montoNeto } = resolverDescuentoTotal({
        baseUSD: baseTrasAnual,
        descuentoBonosUSD: descuentoBonos,
        descuentoReferidoUSD: referido.descuentoUSD,
        todosBonosCombinables: todosCombinables,
    });

    // Modo USD: convertir a moneda local con TasaCambio. Modo COP: bypass total.
    let tasaAplicada: number;
    let montoLocalPagado: number;
    if (esCOP) {
        tasaAplicada = 1;
        montoLocalPagado = Math.max(0, Math.round(montoNeto));
    } else {
        const local = await calcularMontoLocal(montoNeto, suscripcion.monedaLocal);
        if (!local) {
            throw new AppError(
                `No hay tasa de cambio vigente para ${suscripcion.monedaLocal}`,
                ERROR_CODES.SERVICE_UNAVAILABLE,
                503
            );
        }
        tasaAplicada = local.tasaAplicada;
        montoLocalPagado = local.montoLocal;
    }

    // Comprobante cifrado en disco (fail-closed si no hay clave de cifrado).
    const guardado = await guardarComprobanteCifrado(input.comprobante.buffer);

    // Campos del Pago con nombre legacy USD; en modo COP guardan valor COP para
    // preservar el schema (candado Fase 2). Fase 2 (ARQ_16) los renombrará.
    const montoBaseParaPago = esCOP ? 0 : montoBase;
    const descuentoAplicadoParaPago = esCOP ? 0 : descuentoAnual + descuentoTotal;
    const montoNetoParaPago = esCOP ? 0 : montoNeto;

    let pago;
    try {
        pago = await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: input.duracion,
            montoBaseUSD: montoBaseParaPago,
            descuentoAplicadoUSD: descuentoAplicadoParaPago,
            montoNetoUSD: montoNetoParaPago,
            tasaCambioAplicada: tasaAplicada,
            montoLocalPagado: montoLocalPagado,
            monedaLocal: suscripcion.monedaLocal,
            metodoDeclarado: input.metodoDeclarado,
            comprobanteAdjuntoUrl: guardado.ruta,
            comprobanteMimeType: input.comprobante.mimeType.trim().toLowerCase(),
            comprobanteHashSha256: guardado.hashSha256,
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
            ...(referido.codigo ? { codigoReferidoUsado: referido.codigo } : {}),
            ...(input.notas ? { notasCliente: input.notas } : {}),
        });
    } catch (error) {
        console.error(
            `[PAGOS/RENOVACION] Error creando pago: ${error instanceof Error ? error.message : "desconocido"} — comprobante huérfano en ${guardado.ruta}`
        );
        throw new AppError("No se pudo registrar la renovación", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    if (bonosPendientes.length > 0) {
        await clienteRepo.vincularBonosAPago(bonosPendientes.map((b) => b.id), pago.id);
    }

    await logAudit({
        accion: "PAGO_REPORTADO",
        tipoRecurso: "Pago",
        recursoId: pago.id,
        usuarioId: usuario.id,
        colegioId: suscripcion.colegioId ?? undefined,
        valorNuevo: JSON.stringify({
            suscripcionId: suscripcion.id,
            duracion: input.duracion,
            metodoDeclarado: input.metodoDeclarado,
            montoNetoUSD: montoNeto,
            monedaLocal: suscripcion.monedaLocal,
            codigoReferidoUsado: referido.codigo ?? null,
            bonosConsumidos: bonosPendientes.length,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    await emitirEventoPagoReportado({
        pagoId: pago.id,
        suscripcionId: suscripcion.id,
        montoNetoUSD: montoNeto,
        monedaLocal: suscripcion.monedaLocal,
    });

    return {
        pagoId: pago.id,
        estado: pago.estado,
        montoNetoUSD: montoNeto,
        montoLocalPagado,
        monedaLocal: suscripcion.monedaLocal,
        comprobanteHashSha256: guardado.hashSha256,
    };
}
