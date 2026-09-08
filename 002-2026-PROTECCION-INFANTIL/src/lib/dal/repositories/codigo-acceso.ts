/**
 * SPEC-584 (Fase 3) · Repositorio de códigos temporales de acceso externo al texto.
 */
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

/** Select del reporte necesario en el ciclo de vida del código (sin PII del relato). */
const REPORTE_PARA_CODIGO = {
    id: true,
    esAnonimo: true,
    usuarioId: true,
    contenidoId: true,
    identificador: true,
} satisfies Prisma.ReporteSelect;

export class CodigoAccesoContenidoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Busca por hash del código (lo único que se persiste en reposo). */
    findPorCodigoHash(codigoHash: string) {
        return this.db.codigoAccesoContenido.findUnique({
            where: { codigoHash },
            include: { reporte: { select: REPORTE_PARA_CODIGO } },
        });
    }

    /** Busca por hash del token de sesión de visualización. */
    findPorTokenSesion(sesionTokenHash: string) {
        return this.db.codigoAccesoContenido.findUnique({
            where: { sesionTokenHash },
            include: {
                reporte: { select: REPORTE_PARA_CODIGO },
                canjeadoPor: { select: { id: true, nombre: true, rol: true } },
            },
        });
    }
}
