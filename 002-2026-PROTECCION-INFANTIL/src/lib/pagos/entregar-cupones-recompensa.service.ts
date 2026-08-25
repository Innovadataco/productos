/**
 * SPEC-246 (002-PI-149): generación y entrega de cupones de recompensa tras el
 * primer pago pagado de un padre.
 *
 * - Idempotencia dura: una entrega por padre por vida.
 * - Genera códigos `CUP-XXXXXX` únicos contra `BonoPromocional.nombre`.
 * - Emite evento `bono.entregado_recompensa` (EMAIL+IN_APP) de forma fail-open.
 * - AuditLog `BONO_CREADO` por cada cupón entregado.
 */
import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { AccionAudit, OrigenBono, TipoBono } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { programar } from "@/lib/notificaciones/motor";
import { obtenerParametrosRecompensa } from "./parametros-pagos";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import type { DbClient } from "@/lib/dal/unit-of-work";

const ZONA_BOGOTA = "America/Bogota";
const PREFIJO_CUPON = "CUP";
const LONGITUD_CODIGO = 6;
const MAX_INTENTOS_POR_CODIGO = 10;

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

function formatoFechaBogota(fecha: Date): string {
    return formatInTimeZone(fecha, ZONA_BOGOTA, "yyyy-MM-dd");
}

function generarCodigoAleatorio(): string {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(LONGITUD_CODIGO);
    let codigo = "";
    for (let i = 0; i < LONGITUD_CODIGO; i++) {
        codigo += caracteres[bytes[i] % caracteres.length];
    }
    return `${PREFIJO_CUPON}-${codigo}`;
}

export interface EntregarCuponesRecompensaInput {
    padreUsuarioId: string;
    adminId: string;
    email?: string | undefined;
    nombre?: string | null | undefined;
}

export interface EntregarCuponesRecompensaResultado {
    entregados: number;
    codigos: string[];
    vigenciaHasta: string;
}

async function generarCodigoUnico(repo: PagosRepository): Promise<string> {
    for (let intento = 1; intento <= MAX_INTENTOS_POR_CODIGO; intento++) {
        const codigo = generarCodigoAleatorio();
        const existente = await repo.obtenerBonoPromocionalPorNombre(codigo);
        if (!existente) return codigo;
        console.warn(`[Recompensa] Colisión de código ${codigo}; reintento ${intento}`);
    }
    throw new AppError("No se pudo generar un código de cupón único", ERROR_CODES.INTERNAL_ERROR, 500);
}

async function emitirEventoEntregado(
    padreUsuarioId: string,
    email: string | undefined,
    nombre: string | null | undefined,
    codigos: string[],
    porcentaje: number,
    vigenciaHasta: string
): Promise<void> {
    const variables = {
        nombre: nombre ?? "",
        codigos: codigos.join(", "),
        porcentaje,
        vigenciaHasta,
    };

    const destinatarios: Array<{ usuarioId?: string | undefined; email?: string | undefined; variables: Record<string, unknown> }> = [];
    if (email) {
        destinatarios.push({ email, variables });
    } else {
        destinatarios.push({ usuarioId: padreUsuarioId, variables });
    }

    try {
        await programar({
            evento: "bono.entregado_recompensa",
            sujetoTipo: "Usuario",
            sujetoId: padreUsuarioId,
            destinatarios,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Recompensa] Evento entregado: motor no disponible (${msg}); se continúa`);
    }
}

/**
 * Entrega cupones de recompensa a un padre tras su primer pago pagado.
 * Es idempotente: si el padre ya tiene bonos `RECOMPENSA_PAGO`, no genera más.
 * La operación es atómica (una transacción para todos los cupones).
 */
export async function entregarCuponesRecompensa(
    input: EntregarCuponesRecompensaInput,
    tx?: DbClient
): Promise<EntregarCuponesRecompensaResultado | null> {
    return withUnitOfWork(async (db) => {
        const repo = new PagosRepository(db);

        const existentes = await repo.contarBonosRecompensaPorBeneficiario(input.padreUsuarioId);
        if (existentes > 0) {
            console.warn(`[Recompensa] Padre ${input.padreUsuarioId} ya recibió cupones; se omite entrega`);
            return null;
        }

        const params = await obtenerParametrosRecompensa();
        const ahora = ahoraBogota();
        const vigenciaFin = addDays(ahora, params.vigenciaDias);
        const topeMaxCOP = params.topeMaxCOP;

        const codigos: string[] = [];
        for (let i = 0; i < params.cuponesPorPago; i++) {
            codigos.push(await generarCodigoUnico(repo));
        }

        const descripcion = topeMaxCOP && topeMaxCOP > 0
            ? `Cupón de recompensa por primer pago. Tope máximo ${topeMaxCOP} COP.`
            : "Cupón de recompensa por primer pago.";

        const creados = await Promise.all(
            codigos.map((codigo) =>
                repo.crearBonoPromocional({
                    nombre: codigo,
                    tipo: TipoBono.DESCUENTO_PCT,
                    valor: params.porcentajeDescuento,
                    vigenciaInicio: ahora,
                    vigenciaFin,
                    usosMaximosTotales: 1,
                    usosMaximosPorCliente: 1,
                    aplicaANuevos: true,
                    aplicaARenovaciones: false,
                    activo: true,
                    descripcion,
                    creadoPorAdminId: input.adminId,
                    origen: OrigenBono.RECOMPENSA_PAGO,
                    beneficiarioUsuarioId: input.padreUsuarioId,
                    transferible: true,
                })
            )
        );

        const vigenciaHasta = formatoFechaBogota(vigenciaFin);

        await Promise.all(
            creados.map((bono) =>
                logAudit({
                    accion: AccionAudit.BONO_CREADO,
                    tipoRecurso: "BonoPromocional",
                    recursoId: bono.id,
                    usuarioId: input.adminId,
                    valorNuevo: JSON.stringify({
                        nombre: bono.nombre,
                        origen: OrigenBono.RECOMPENSA_PAGO,
                        beneficiarioUsuarioId: input.padreUsuarioId,
                        transferible: true,
                        vigenciaHasta,
                    }),
                    metadatos: { evento: "bono.entregado_recompensa", padreUsuarioId: input.padreUsuarioId },
                    tx: db,
                })
            )
        );

        await emitirEventoEntregado(
            input.padreUsuarioId,
            input.email,
            input.nombre,
            codigos,
            params.porcentajeDescuento,
            vigenciaHasta
        );

        console.warn(`[Recompensa] Entregados ${codigos.length} cupones a padre ${input.padreUsuarioId}`);
        return { entregados: codigos.length, codigos, vigenciaHasta };
    }, tx);
}

export interface CuponRecompensaDTO {
    id: string;
    nombre: string;
    valor: number;
    vigenciaInicio: Date;
    vigenciaFin: Date;
    usos: number;
}

/**
 * SPEC-246 (002-PI-149): lista los cupones de recompensa de un padre con el
 * conteo de usos para que la UI determine estado (vigente / usado / vencido).
 */
export async function obtenerCuponesRecompensaDelUsuario(usuarioId: string): Promise<CuponRecompensaDTO[]> {
    const repo = new PagosRepository();
    const bonos = await repo.listarBonosPorBeneficiario(usuarioId, OrigenBono.RECOMPENSA_PAGO);
    return bonos.map((b) => ({
        id: b.id,
        nombre: b.nombre,
        valor: b.valor,
        vigenciaInicio: b.vigenciaInicio,
        vigenciaFin: b.vigenciaFin,
        usos: b._count.usos,
    }));
}
