/**
 * SPEC-796 · DAL del registro durable del contrato firmado del colegio (modelo ContratoColegio,
 * tabla contrato_colegio). El registro SOBREVIVE al borrado operativo del colegio (FK SetNull +
 * snapshots), por eso lee/escribe por `colegioId` pero conserva la identidad en `colegioSnapshot`.
 *
 * Append-only: se CREA un hecho por cada adjunto (reemplazar = hecho nuevo); nunca se actualiza ni
 * se borra desde producción (la purga demo borra; el borrado operativo PRESERVA — lo cubre el
 * script de limpieza, no este repo).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";

export interface NuevoContratoColegio {
    colegioId: string;
    suscripcionId: string | null;
    colegioSnapshot: string;
    archivoId: string;
    sha256: string;
    adjuntadoEn: Date;
    adjuntadoPorSnapshot: string;
}

export class ContratoColegioRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Registra un adjunto (hecho append-only). */
    crear(data: NuevoContratoColegio) {
        return this.db.contratoColegio.create({ data });
    }

    /**
     * El contrato VIGENTE de un colegio = el último adjuntado (reemplazar deja varios; vale el más
     * reciente). Devuelve null si el colegio no tiene ninguno (estado SIN contrato).
     */
    vigentePorColegio(colegioId: string) {
        return this.db.contratoColegio.findFirst({
            where: { colegioId },
            orderBy: { adjuntadoEn: "desc" },
        });
    }

    /** Un contrato por id (para el endpoint de descarga guardado). */
    porId(id: string) {
        return this.db.contratoColegio.findUnique({ where: { id } });
    }
}
