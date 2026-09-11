import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { conActor } from "@/lib/auditoria-lectura/actor";
import {
    generarCodigoAcceso,
    hashCodigoAcceso,
    normalizarCodigoAcceso,
} from "@/lib/acceso-codigo";
import { logAudit } from "@/lib/audit";
import { programar } from "@/lib/notificaciones";
import { logger } from "@/lib/logger";
import { descifrarCampoReporte } from "./descifrar-contenido";
import { CodigoAccesoContenidoRepository } from "../repositories/codigo-acceso";

/**
 * SPEC-584 (Fase 3) + SPEC-610 (D-123/D-129/D-130) · Ciclo de vida del PASE de
 * acceso externo — que ahora cuelga del EXPEDIENTE, no de un reporte suelto.
 *
 * Flujo:
 * 1. El PADRE dueño del EXPEDIENTE genera un pase: 8 caracteres sin ambigüedades,
 *    30 min para CANJEAR, un solo pase activo por expediente. Viaja por correo y se
 *    muestra una sola vez en pantalla. (D-129: es «el pase», nunca «código».)
 * 2. El profesional (o el padre) autenticado lo CANJEA una vez → sesión de 15 min +
 *    token opaco (solo su sha-256 se persiste). El solicitante recibe correo de quién canjeó.
 * 3. Con el token se lee el EXPEDIENTE COMPLETO: TODOS sus eventos (con o sin
 *    `reporteId`). CADA evento leído escribe su PROPIA fila en `LecturaReporte` (por
 *    `eventoId`, actor EXTERNO). Solo `texto` (trabajo) — nunca `textoOriginal`.
 *
 * Alcance por construcción: `/ver` deriva el `expedienteId` del token (nunca del
 * cliente); un pase de un expediente no abre otro.
 */

const VIGENCIA_CODIGO_MS = 30 * 60 * 1000;
const VIGENCIA_SESION_MS = 15 * 60 * 1000;

// NOTA (deuda): las claves de evento conservan «reporte» por compatibilidad con las
// reglas de notificación ya sembradas; renombrarlas a «expediente» exige nuevas
// reglas y es entrega aparte. El sujeto sí es el expediente.
const EVENTO_CODIGO_SOLICITADO = "padre.reporte.acceso_codigo";
const EVENTO_CODIGO_CANJEADO = "padre.reporte.acceso_canjeado";

/** Datos del expediente para validar titularidad y armar correos. */
interface ExpedienteParaPase {
    id: string;
    padreUsuarioId: string;
    identificadorReportado: string;
}

/** Un evento del expediente tal como lo ve el profesional al canjear (D-130). */
export interface EventoLeidoDto {
    eventoId: string;
    fecha: Date;
    texto: string;
    /** true = «Anotado por la familia» (sin reporte, sin chip de gravedad, D-130). */
    esManual: boolean;
    /** Categoría del análisis; SOLO en eventos de origen reporte. null en los manuales. */
    categoria: string | null;
}

async function cargarExpedienteParaPase(expedienteId: string): Promise<ExpedienteParaPase | null> {
    return prisma.expediente.findUnique({
        where: { id: expedienteId },
        select: { id: true, padreUsuarioId: true, identificadorReportado: true },
    });
}

/** Solo el PADRE dueño del expediente puede generar su pase (D-126: expediente = padre autenticado). */
function exigirTitular(exp: ExpedienteParaPase | null, usuarioId: string): ExpedienteParaPase {
    if (!exp || exp.padreUsuarioId !== usuarioId) {
        // 404 deliberado (no 403): no revelar la existencia ni titularidad del expediente.
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    return exp;
}

/**
 * PASO 1 · El padre dueño genera el pase del expediente. Devuelve el pase en claro
 * (para mostrarlo UNA vez en pantalla) junto a su vigencia; en reposo queda solo el hash.
 */
export async function solicitarCodigoAcceso(params: {
    expedienteId: string;
    solicitadoPorId: string;
    ip?: string;
}): Promise<{ codigo: string; vigenteHasta: Date }> {
    const expediente = exigirTitular(await cargarExpedienteParaPase(params.expedienteId), params.solicitadoPorId);

    const codigo = generarCodigoAcceso();
    const ahora = new Date();
    const vigenteHasta = new Date(ahora.getTime() + VIGENCIA_CODIGO_MS);

    await prisma.$transaction(async (tx) => {
        // Un solo pase activo por EXPEDIENTE: la nueva solicitud expira los anteriores sin canjear.
        await tx.codigoAccesoContenido.updateMany({
            where: { expedienteId: expediente.id, canjeadoEn: null, vigenteHasta: { gt: ahora } },
            data: { vigenteHasta: ahora },
        });
        await tx.codigoAccesoContenido.create({
            data: {
                expedienteId: expediente.id,
                codigoHash: hashCodigoAcceso(codigo),
                solicitadoPorId: params.solicitadoPorId,
                vigenteHasta,
                ...(params.ip ? { ipSolicitud: params.ip } : {}),
            },
        });
    });

    await logAudit({
        accion: "CODIGO_ACCESO_SOLICITADO",
        tipoRecurso: "Expediente",
        recursoId: expediente.id,
        usuarioId: params.solicitadoPorId,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        // El pase en claro NUNCA va a la auditoría: solo su hash (rastreable, no usable).
        metadatos: { codigoHash: hashCodigoAcceso(codigo) },
    });

    // Correo con el pase (canal oficial). Best-effort con log: el padre ya lo ve en pantalla.
    try {
        const resultado = await programar({
            evento: EVENTO_CODIGO_SOLICITADO,
            sujetoTipo: "Expediente",
            sujetoId: expediente.id,
            destinatarios: [
                {
                    usuarioId: params.solicitadoPorId,
                    rol: "PARENT",
                    variables: {
                        codigo,
                        identificador: expediente.identificadorReportado,
                        vigenteMinutos: 30,
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            logger.info(`[Pase] Sin regla activa para ${EVENTO_CODIGO_SOLICITADO} (expediente=${expediente.id}).`);
        }
    } catch (error) {
        logger.error("[Pase] Error encolando el correo con el pase:", error);
    }

    return { codigo, vigenteHasta };
}

/**
 * PASO 2 · Profesional (o padre) autenticado canjea el pase. Devuelve el token opaco
 * de la sesión de visualización (15 min). Un solo canje: la condición `canjeadoEn: null`
 * en el update hace que una carrera dé 409 al perdedor.
 */
export async function canjearCodigoAcceso(params: {
    codigoCrudo: string;
    canjeadoPor: { id: string; nombre: string | null; rol: string };
    ip?: string;
}): Promise<{ tokenSesion: string; expiraEn: Date; expedienteId: string }> {
    const codigo = normalizarCodigoAcceso(params.codigoCrudo);
    if (!/^[A-Z2-9]{6,12}$/.test(codigo)) {
        throw new AppError("Pase inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const registro = await new CodigoAccesoContenidoRepository().findPorCodigoHash(hashCodigoAcceso(codigo));
    if (!registro) {
        throw new AppError("Pase no válido", ERROR_CODES.NOT_FOUND, 404);
    }

    const ahora = new Date();
    if (registro.vigenteHasta.getTime() <= ahora.getTime()) {
        throw new AppError("El pase expiró. Pídale uno nuevo al padre o la madre.", ERROR_CODES.GONE, 410);
    }
    if (registro.canjeadoEn) {
        throw new AppError("El pase ya fue usado. Pídale uno nuevo al padre o la madre.", ERROR_CODES.CONFLICT, 409);
    }

    const tokenSesion = randomUUID();
    const expiraEn = new Date(ahora.getTime() + VIGENCIA_SESION_MS);
    const actualizado = await prisma.codigoAccesoContenido.updateMany({
        where: { id: registro.id, canjeadoEn: null },
        data: {
            canjeadoEn: ahora,
            canjeadoPorId: params.canjeadoPor.id,
            sesionExpiraEn: expiraEn,
            sesionTokenHash: hashCodigoAcceso(tokenSesion),
            ...(params.ip ? { ipCanje: params.ip } : {}),
        },
    });
    if (actualizado.count === 0) {
        throw new AppError("El pase ya fue usado. Pídale uno nuevo al padre o la madre.", ERROR_CODES.CONFLICT, 409);
    }

    await logAudit({
        accion: "CODIGO_ACCESO_CANJEADO",
        tipoRecurso: "Expediente",
        recursoId: registro.expedienteId,
        usuarioId: params.canjeadoPor.id,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        metadatos: { codigoAccesoId: registro.id, solicitadoPorId: registro.solicitadoPorId },
    });

    // D-129: el padre solicitante recibe correo avisando QUIÉN canjeó su pase.
    try {
        const resultado = await programar({
            evento: EVENTO_CODIGO_CANJEADO,
            sujetoTipo: "Expediente",
            sujetoId: registro.expedienteId,
            destinatarios: [
                {
                    usuarioId: registro.solicitadoPorId,
                    rol: "PARENT",
                    variables: {
                        nombreCanjeador: params.canjeadoPor.nombre ?? "Un profesional",
                        rolCanjeador: params.canjeadoPor.rol,
                        identificador: registro.expediente.identificadorReportado,
                        fechaCanje: ahora.toLocaleString("es-CO", { timeZone: "America/Bogota" }),
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            logger.info(`[Pase] Sin regla activa para ${EVENTO_CODIGO_CANJEADO} (expediente=${registro.expedienteId}).`);
        }
    } catch (error) {
        logger.error("[Pase] Error encolando el aviso de canje al solicitante:", error);
    }

    return { tokenSesion, expiraEn, expedienteId: registro.expedienteId };
}

/**
 * PASO 3 · Lectura del EXPEDIENTE COMPLETO con la sesión. Revalida la expiración en
 * CADA llamada. Devuelve TODOS los eventos (D-130: manuales incluidos, marcados). Por
 * CADA evento leído se descifra su `texto` (nunca `textoOriginal`) DENTRO de `conActor`
 * como actor EXTERNO → una fila `LecturaReporte` por evento (por su `eventoId`, gate del CEO).
 * El `expedienteId` sale del token, jamás del cliente.
 */
export async function leerExpedienteConSesion(params: {
    tokenSesion: string;
    ip?: string;
    userAgent?: string;
}): Promise<{ eventos: EventoLeidoDto[]; gravedad: string; expiraEn: Date }> {
    const registro = await new CodigoAccesoContenidoRepository().findPorTokenSesion(
        hashCodigoAcceso(params.tokenSesion)
    );
    const ahora = new Date();
    if (!registro || !registro.sesionExpiraEn || registro.sesionExpiraEn.getTime() <= ahora.getTime()) {
        throw new AppError(
            "La sesión de visualización expiró. Pídale un nuevo pase al padre o la madre.",
            ERROR_CODES.GONE,
            410
        );
    }

    const eventos = await conActor(
        {
            ...(registro.canjeadoPor?.id ? { usuarioId: registro.canjeadoPor.id } : {}),
            ...(registro.canjeadoPor?.rol ? { rol: registro.canjeadoPor.rol } : {}),
            tipoActor: "EXTERNO",
            codigoAccesoId: registro.id,
            ...(params.ip ? { ip: params.ip } : {}),
            ...(params.userAgent ? { userAgent: params.userAgent } : {}),
        },
        async () => {
            const salida: EventoLeidoDto[] = [];
            for (const ev of registro.expediente.eventos) {
                // Cada descifrado escribe su propia fila LecturaReporte (por eventoId,
                // vía resolverDuenos en la frontera DAL). Nunca textoOriginal.
                const texto = await descifrarCampoReporte(ev.contenidoId, "texto");
                salida.push({
                    eventoId: ev.id,
                    fecha: ev.fechaEvento,
                    texto,
                    esManual: ev.reporteId === null,
                    // D-130: los manuales no llevan clasificación; solo los de origen reporte.
                    categoria: ev.reporteId === null ? null : ev.categoriaDetectada,
                });
            }
            return salida;
        }
    );

    return { eventos, gravedad: registro.expediente.scoreGravedadActual, expiraEn: registro.sesionExpiraEn };
}
