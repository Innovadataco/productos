/**
 * SPEC-584 (Fase 3) · Repositorio de códigos temporales de acceso externo al texto.
 * SPEC-610 (D-123/D-130): el pase cuelga del EXPEDIENTE, no de un Reporte. Al canjear
 * se lee el expediente COMPLETO (todos sus eventos, con o sin `reporteId`).
 */
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

/** Expediente mínimo para canjear (armar el correo al padre). */
const EXPEDIENTE_PARA_CANJE = {
    id: true,
    identificadorReportado: true,
} satisfies Prisma.ExpedienteSelect;

/**
 * Expediente + sus eventos para la LECTURA por el profesional. Cada evento trae su
 * `contenidoId` (para descifrar `texto`), su `reporteId` (null = «Anotado por la
 * familia», D-130), y su clasificación (solo la muestran los de origen reporte —
 * un evento manual NUNCA lleva chip de gravedad, D-130).
 */
const EXPEDIENTE_PARA_LECTURA = {
    id: true,
    scoreGravedadActual: true,
    identificadorReportado: true,
    eventos: {
        select: {
            id: true,
            contenidoId: true,
            reporteId: true,
            fechaEvento: true,
            categoriaDetectada: true,
            confianzaClasificacion: true,
            ordenSecuencial: true,
        },
        orderBy: { ordenSecuencial: "asc" },
    },
} satisfies Prisma.ExpedienteSelect;

export class CodigoAccesoContenidoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Busca por hash del código (lo único que se persiste en reposo). */
    findPorCodigoHash(codigoHash: string) {
        return this.db.codigoAccesoContenido.findUnique({
            where: { codigoHash },
            include: { expediente: { select: EXPEDIENTE_PARA_CANJE } },
        });
    }

    /** Busca por hash del token de sesión de visualización (trae el expediente + sus eventos). */
    findPorTokenSesion(sesionTokenHash: string) {
        return this.db.codigoAccesoContenido.findUnique({
            where: { sesionTokenHash },
            include: {
                expediente: { select: EXPEDIENTE_PARA_LECTURA },
                canjeadoPor: { select: { id: true, nombre: true, rol: true } },
            },
        });
    }

    /**
     * SPEC-610 (I-372 · D-129) · «Quién ha leído este expediente»: los pases de ESTE
     * expediente que ya se CANJEARON — quién los canjeó y cuándo, y cuántos eventos se
     * leyeron con cada uno (`_count.lecturas`). SOLO metadatos: nunca el contenido. El
     * ámbito lo pone el `expedienteId` (el llamador ya verificó la titularidad del padre).
     */
    listarAccesosPorExpediente(expedienteId: string) {
        return this.db.codigoAccesoContenido.findMany({
            where: { expedienteId, canjeadoEn: { not: null } },
            orderBy: { canjeadoEn: "desc" },
            select: {
                id: true,
                canjeadoEn: true,
                canjeadoPor: { select: { nombre: true, rol: true } },
                _count: { select: { lecturas: true } },
            },
        });
    }
}
