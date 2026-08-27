/**
 * SPEC-211 (002-PI-111): armado de la vista de suscripción del cliente
 * (rector/padre). Lo consumen el endpoint GET /api/pagos/suscripcion y las
 * páginas server-side `/dashboard/{colegio,padre}/suscripcion` (mismo DTO).
 *
 * Frontera DAL: solo repositorios (`PagosRepository`, `PagosClienteRepository`);
 * nada de `@/lib/prisma` en rutas ni páginas (SC-005).
 */
import type { RolUsuario } from "@prisma/client";
import { EstadoSuscripcion } from "@prisma/client";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { calcularMontoLocal } from "./tasas";
import {
    anioBogota,
    calcularDescuentoAnualUSD,
    calcularDiasRestantesBogota,
} from "./renovacion-calculos";
import { calcularDiasRestantesFreemium } from "./freemium-calculos";
import {
    esContratoObligatorio,
    obtenerDescuentoAnualDefaultPct,
    obtenerDescuentoReferidoPct,
    obtenerLimitesComprobante,
} from "./parametros-pagos";
import type { OpcionRenovacion, PagoHistorialItem, VistaSuscripcion } from "./suscripcion-vista.types";

export type { OpcionRenovacion, PagoHistorialItem, VistaSuscripcion } from "./suscripcion-vista.types";

export interface UsuarioTitular {
    id: string;
    rol: RolUsuario;
    colegioId: string | null;
}

type SuscripcionConRelaciones = NonNullable<Awaited<ReturnType<PagosClienteRepository["obtenerSuscripcionActualDeColegio"]>>>;

/**
 * Suscripción propia del usuario autenticado: la del colegio para SCHOOL_ADMIN,
 * la del usuario para PARENT. Null si el titular aún no tiene suscripción.
 */
export async function obtenerSuscripcionTitular(usuario: UsuarioTitular): Promise<SuscripcionConRelaciones | null> {
    const repo = new PagosClienteRepository();
    if (usuario.rol === "SCHOOL_ADMIN") {
        if (!usuario.colegioId) return null;
        return repo.obtenerSuscripcionActualDeColegio(usuario.colegioId);
    }
    if (usuario.rol === "PARENT") {
        return repo.obtenerSuscripcionActualDeUsuario(usuario.id);
    }
    return null;
}

/**
 * Verifica que `suscripcionId` pertenece al usuario autenticado. Devuelve la
 * suscripción o null (los endpoints traducen null a 404, sin filtrar existencia).
 */
export async function verificarTitularidad(
    suscripcionId: string,
    usuario: UsuarioTitular
): Promise<SuscripcionConRelaciones | null> {
    const propia = await obtenerSuscripcionTitular(usuario);
    if (!propia || propia.id !== suscripcionId) return null;
    return propia;
}

function mapPagoHistorial(pago: {
    id: string;
    estado: string;
    duracionCubierta: string;
    montoNetoUSD: number;
    montoLocalPagado: number;
    monedaLocal: string;
    metodoDeclarado: string;
    fechaReporte: Date;
    motivoRechazo: string | null;
}): PagoHistorialItem {
    return {
        id: pago.id,
        estado: pago.estado,
        duracionCubierta: pago.duracionCubierta,
        montoNetoUSD: pago.montoNetoUSD,
        montoLocalPagado: pago.montoLocalPagado,
        monedaLocal: pago.monedaLocal,
        metodoDeclarado: pago.metodoDeclarado,
        fechaReporte: pago.fechaReporte.toISOString(),
        motivoRechazo: pago.motivoRechazo,
    };
}

/** DTO completo de la vista de suscripción del cliente (o null si no tiene). */
export async function obtenerVistaSuscripcion(usuario: UsuarioTitular): Promise<VistaSuscripcion | null> {
    const suscripcion = await obtenerSuscripcionTitular(usuario);
    if (!suscripcion) return null;

    const repo = new PagosRepository();
    const clienteRepo = new PagosClienteRepository();
    const anio = anioBogota();

    const [totales, pagoPendiente, pagos, referidosExitosos, planes, limites, descuentoAnualDefault, descuentoReferidoPct, contratoObligatorio] =
        await Promise.all([
            clienteRepo.sumarPagosAutorizados(suscripcion.id),
            clienteRepo.obtenerPagoPendiente(suscripcion.id),
            repo.listarPagosPorSuscripcion(suscripcion.id),
            repo.contarReferidosExitososPorAnio(suscripcion.id, anio),
            clienteRepo.listarPlanesActivosPorTitular(suscripcion.tipoTitular, anio),
            obtenerLimitesComprobante(),
            obtenerDescuentoAnualDefaultPct(),
            obtenerDescuentoReferidoPct(),
            esContratoObligatorio(suscripcion.tipoTitular),
        ]);

    const opcionesRenovacion: OpcionRenovacion[] = [];
    for (const plan of planes) {
        const pct = plan.duracion === "MES_12" ? plan.descuentoAnualPct ?? descuentoAnualDefault : 0;
        const precioNetoUSD = plan.precioBaseUSD - calcularDescuentoAnualUSD(plan.precioBaseUSD, pct);
        const local = await calcularMontoLocal(precioNetoUSD, suscripcion.monedaLocal);
        opcionesRenovacion.push({
            duracion: plan.duracion,
            precioBaseUSD: plan.precioBaseUSD,
            descuentoAnualPct: pct,
            precioNetoUSD,
            montoLocal: local?.montoLocal ?? null,
            monedaLocal: suscripcion.monedaLocal,
        });
    }

    const puedeRenovar =
        (suscripcion.estado === EstadoSuscripcion.ACTIVA || suscripcion.estado === EstadoSuscripcion.EN_GRACIA) &&
        !pagoPendiente;

    return {
        id: suscripcion.id,
        estado: suscripcion.estado,
        esFreemium: suscripcion.esFreemium,
        // SPEC-217 (002-PI-117): FR-008 — datos de freemium para la vista cliente.
        freemiumFechaFin: suscripcion.freemiumFechaFin?.toISOString() ?? null,
        diasRestantesFreemium: calcularDiasRestantesFreemium(suscripcion.esFreemium, suscripcion.freemiumFechaFin),
        diasRestantes: calcularDiasRestantesBogota(suscripcion.fechaFin),
        fechaInicio: suscripcion.fechaInicio.toISOString(),
        fechaFin: suscripcion.fechaFin.toISOString(),
        plan: {
            nombre: suscripcion.planActual.nombre,
            duracion: suscripcion.planActual.duracion,
            precioBaseUSD: suscripcion.planActual.precioBaseUSD,
            // SPEC-289 (002-PI-189 · Fase 1): consumido por AplicarBonoCard como
            // fuente única del monto base para bonos en suscripciones COP.
            precioBaseCOP: suscripcion.planActual.precioBaseCOP,
        },
        totalPagadoUSD: totales._sum.montoNetoUSD ?? 0,
        totalPagadoLocal: totales._sum.montoLocalPagado ?? 0,
        monedaLocal: suscripcion.monedaLocal,
        codigoReferidoPropio: suscripcion.codigoReferidoPropio,
        referidosExitososEsteAnio: referidosExitosos,
        contratoPDFUrl: suscripcion.contratoPDFUrl,
        contratoObligatorio,
        pagoPendiente: pagoPendiente
            ? {
                id: pagoPendiente.id,
                estado: pagoPendiente.estado,
                montoNetoUSD: pagoPendiente.montoNetoUSD,
                montoLocalPagado: pagoPendiente.montoLocalPagado,
                monedaLocal: pagoPendiente.monedaLocal,
                fechaReporte: pagoPendiente.fechaReporte.toISOString(),
            }
            : null,
        pagos: pagos.map(mapPagoHistorial),
        opcionesRenovacion,
        limitesComprobante: limites,
        descuentoReferidoPct,
        puedeRenovar,
    };
}
