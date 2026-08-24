/**
 * SPEC-226 (002-PI-mega-cola, FR-003): handler `crear_bono` — retención
 * automática. Crea un `BonoPromocional` vía `PagosRepository.crearBonoPromocional`
 * (SPEC-216, solo consumo: cero cambios al módulo Pagos) con nombre único
 * trazable a la regla y vigencia calculada en America/Bogota (D-69).
 *
 * `creadoPorAdminId = regla.creadaPorAdminId`: el admin dueño de la regla queda
 * como autor del bono (trazabilidad humana de una acción automática).
 *
 * Rollback: `activo = false`. Si el bono ya tiene `BonoAplicado` asociados, se
 * desactiva igual pero NO se tocan usos ni pagos existentes (edge case de la
 * spec; el detalle lo registra).
 */
import { addDays, endOfDay, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { crearBonoSchema } from "../schemas";
import type { AccionHandler } from "../types";

export const ZONA_BOGOTA = "America/Bogota";

export interface VigenciaBono {
    vigenciaInicio: Date;
    vigenciaFin: Date;
}

/**
 * Vigencia en días calendario Bogotá: inicio 00:00:00.000 Bogotá de hoy, fin
 * 23:59:59.999 Bogotá de hoy + `vigenciaDias`. Un bono creado a las 23:59
 * Bogotá vence a las 23:59 del día `hoy + vigenciaDias` Bogotá (SC-006).
 */
export function calcularVigenciaBono(ahora: Date, vigenciaDias: number): VigenciaBono {
    const zoned = toZonedTime(ahora, ZONA_BOGOTA);
    const inicioZoned = startOfDay(zoned);
    const finZoned = endOfDay(addDays(zoned, vigenciaDias));
    return {
        vigenciaInicio: fromZonedTime(inicioZoned, ZONA_BOGOTA),
        vigenciaFin: fromZonedTime(finZoned, ZONA_BOGOTA),
    };
}

/**
 * Nombre único y trazable: `AUT-<reglaClave>-<sujetoCorto>-<yyyyMMdd>`
 * (determinístico; en reintentos de la misma ventana la dedup de SPEC-221 ya
 * evitó la segunda recomendación, así que no colisiona en el flujo normal).
 */
export function generarNombreBono(reglaClave: string, sujetoId: string, ahora: Date): string {
    const claveSlug = reglaClave.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const fecha = formatInTimeZone(ahora, ZONA_BOGOTA, "yyyyMMdd");
    return `AUT-${claveSlug}-${sujetoId.slice(0, 8)}-${fecha}`;
}

export const crearBonoHandler: AccionHandler = {
    clave: "crear_bono",
    tipo: "CREAR_BONO",

    async ejecutar(ctx) {
        const parsed = crearBonoSchema.safeParse(ctx.parametros);
        if (!parsed.success) {
            const detalle = parsed.error.issues[0]?.message ?? "esquema inválido";
            throw new AppError(`parametros_invalidos: ${detalle}`, ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const params = parsed.data;

        if (ctx.recomendacion.sujetoTipo !== "Suscripcion" || !ctx.recomendacion.sujetoId) {
            throw new AppError("sujeto_no_valido", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const suscripcion = await ctx.repo.obtenerSuscripcionParaAccion(ctx.recomendacion.sujetoId);
        if (!suscripcion || suscripcion.estado === "CANCELADA") {
            // Edge case: suscripción cancelada entre generación y ejecución.
            throw new AppError("sujeto_no_valido", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const ahora = new Date();
        const { vigenciaInicio, vigenciaFin } = calcularVigenciaBono(ahora, params.vigenciaDias);
        const nombre = generarNombreBono(ctx.regla.clave, suscripcion.id, ahora);

        const bono = await new PagosRepository(ctx.tx).crearBonoPromocional({
            nombre,
            tipo: params.tipoBono,
            valor: params.valor,
            vigenciaInicio,
            vigenciaFin,
            aplicaARenovaciones: true,
            activo: true,
            descripcion: `Bono automático de la regla ${ctx.regla.clave} (SPEC-226)`,
            creadoPorAdminId: ctx.regla.creadaPorAdminId,
        });

        return { resultado: { bonoId: bono.id, nombre: bono.nombre } };
    },

    async revertir(ctx) {
        const resultado = (ctx.ejecucion.resultado ?? {}) as Record<string, unknown>;
        const bonoId = typeof resultado["bonoId"] === "string" ? resultado["bonoId"] : null;
        if (!bonoId) {
            return { detalle: "sin bono asociado a la ejecución" };
        }
        const usos = await ctx.repo.contarUsosBono(bonoId);
        await new PagosRepository(ctx.tx).actualizarBonoPromocional(bonoId, { activo: false });
        return {
            detalle: usos > 0 ? "bono con usos: solo desactivado" : "Bono desactivado",
            resultadoPatch: { revertido: { bonoId, usosPrevios: usos } },
        };
    },
};
