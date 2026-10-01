/**
 * SPEC-751 · Servicio de AUDIENCIA del menor (Decreto 1377/2013 art. 12).
 *
 * Cablea los predicados PUROS de `audiencia-gate.ts` a Prisma:
 *  · LEE `AudienciaMenor` como FUENTE ÚNICA (sin denormalizar en `Hijo`, D-6).
 *  · REGISTRA la declaración de forma inmutable + `AuditLog` en la MISMA transacción —
 *    ése es el rastro DURABLE de responsabilidad (quién/cuándo), porque `declaradoPor` es
 *    SetNull y se vacía al borrar la cuenta (ver comentario de `AudienciaMenor` en el schema).
 *
 * PII de menor: ninguna función recibe un `hijoId` sin exigir el `usuarioId` del titular y
 * verificar la propiedad — un `hijoId` suelto nunca llega a la BD (misma regla que `hijos.ts`).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import { logAudit } from "../../audit";
import { AppError, ERROR_CODES } from "../../errors";
import { getParametroSistemaValor } from "../../parametros";
import { ConsentimientoService } from "./consentimiento";
import {
    menoresPendientesDeAudiencia,
    titularAlDia,
    type MenorActivoAudiencia,
} from "../../consentimiento/audiencia-gate";

/** Política FR-008: re-oír al cambiar la versión (default `true`; la decisión legal es [ABOGADO]). */
async function reoirEnCambioDeVersion(): Promise<boolean> {
    return (
        ((await getParametroSistemaValor("audiencia_menor.reoir_en_cambio_de_version")) ?? "true")
            .trim()
            .toLowerCase() === "true"
    );
}

/**
 * INTERRUPTOR DE ENFORCEMENT del gate (default OFF). El service, el endpoint, el predicado puro y
 * sus candados funcionan SIEMPRE; esto solo decide si el middleware DETIENE la navegación. Nace
 * apagado a propósito: encenderlo ANTES de que exista la pantalla de declaración y su texto
 * [ABOGADO] rebotaría a TODOS los padres existentes (sin filas de `AudienciaMenor`) a un muro que no
 * pueden completar. Se enciende cuando la superficie de declaración esté lista (T010). El cómputo
 * (`hayAudienciaPendiente`) NO depende de esto — refleja el estado real siempre.
 */
export async function gateAudienciaActivo(): Promise<boolean> {
    return (
        ((await getParametroSistemaValor("audiencia_menor.gate_activo")) ?? "false")
            .trim()
            .toLowerCase() === "true"
    );
}

/** Menores ACTIVOS del titular con sus versiones de audiencia (fuente única: `AudienciaMenor`). */
async function cargarMenoresActivos(
    usuarioId: string,
    db: DbClient = prisma,
): Promise<MenorActivoAudiencia[]> {
    const hijos = await db.hijo.findMany({
        where: { usuarioId, estado: "activo" },
        select: { id: true, audienciasMenor: { select: { consentimientoVersion: true } } },
    });
    return hijos.map((h) => ({
        hijoId: h.id,
        versionesAudiencia: h.audienciasMenor.map((a) => a.consentimientoVersion),
    }));
}

/** `hijoId` ACTIVOS que faltan por oír para la versión vigente (per-menor: oír a uno no cubre a otros). */
export async function menoresPendientesDeAudienciaDelTitular(usuarioId: string): Promise<string[]> {
    const consent = new ConsentimientoService();
    const [versionActual, reoir, menores] = await Promise.all([
        consent.versionVigente(),
        reoirEnCambioDeVersion(),
        cargarMenoresActivos(usuarioId),
    ]);
    return menoresPendientesDeAudiencia(menores, versionActual, reoir);
}

/**
 * ¿Hay AL MENOS un menor activo pendiente de audiencia? Es el EJE per-menor solo (el eje de
 * cuenta —SPEC-241— lo gatea su propia compuerta antes). Lo consume la cookie del gate.
 */
export async function hayAudienciaPendiente(usuarioId: string): Promise<boolean> {
    return (await menoresPendientesDeAudienciaDelTitular(usuarioId)).length > 0;
}

/** ¿El titular está «al día»? Cuenta vigente (241) **Y** cero menores activos pendientes. */
export async function titularAlDiaDeAudiencia(usuarioId: string): Promise<boolean> {
    const consent = new ConsentimientoService();
    const [cuentaVigente, versionActual, reoir, menores] = await Promise.all([
        consent.versionEstaActual(usuarioId),
        consent.versionVigente(),
        reoirEnCambioDeVersion(),
        cargarMenoresActivos(usuarioId),
    ]);
    return titularAlDia(cuentaVigente, menores, versionActual, reoir);
}

export interface ResultadoDeclararAudiencia {
    hijoId: string;
    consentimientoVersion: string;
    /** `true` si el hecho YA existía para esa versión (idempotente: no se creó un segundo). */
    yaRegistrada: boolean;
}

/**
 * Declara haber oído a UN menor para la versión vigente. Idempotente por `(hijoId, versión)`:
 * declarar dos veces lo mismo NO crea un segundo hecho (lo garantiza el `@@unique`). La fila es
 * INMUTABLE y se escribe junto al `AuditLog` en una sola transacción. 403/404 si el menor no es
 * del titular (PII: nunca por id suelto).
 */
export async function declararAudienciaMenor(params: {
    usuarioId: string;
    hijoId: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<ResultadoDeclararAudiencia> {
    const { usuarioId, hijoId, ipAddress, userAgent } = params;
    const consentimientoVersion = await new ConsentimientoService().versionVigente();

    // Propiedad del menor (lectura acotada): el hijo DEBE ser del titular.
    const hijo = await prisma.hijo.findFirst({
        where: { id: hijoId, usuarioId },
        select: { id: true },
    });
    if (!hijo) {
        throw new AppError("Menor no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    // ¿Ya existe el hecho para esta versión? → idempotente, sin segundo registro ni segundo audit.
    const existente = await prisma.audienciaMenor.findUnique({
        where: { hijoId_consentimientoVersion: { hijoId, consentimientoVersion } },
        select: { id: true },
    });
    if (existente) {
        return { hijoId, consentimientoVersion, yaRegistrada: true };
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.audienciaMenor.create({
                data: { hijoId, consentimientoVersion, declaradoPor: usuarioId },
            });
            // Rastro DURABLE de responsabilidad en la MISMA tx (schema: declaradoPor es SetNull).
            // Solo metadatos (hijoId + versión), NUNCA PII.
            await logAudit({
                accion: "AUDIENCIA_MENOR_DECLARADA",
                tipoRecurso: "AudienciaMenor",
                recursoId: hijoId,
                usuarioId,
                valorNuevo: JSON.stringify({ hijoId, consentimientoVersion }),
                ipAddress,
                userAgent,
                tx,
            });
        });
    } catch (e) {
        // Carrera (doble clic / dos pestañas): el unique es el árbitro. El otro request ya creó
        // el hecho y su audit → idempotente, sin segundo registro. (catch FUERA de la tx: no la envenena.)
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return { hijoId, consentimientoVersion, yaRegistrada: true };
        }
        throw e;
    }

    return { hijoId, consentimientoVersion, yaRegistrada: false };
}
