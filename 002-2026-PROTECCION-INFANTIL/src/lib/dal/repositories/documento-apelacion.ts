/**
 * SPEC-053 (US3, módulo Comité, SPEC-110): repositorio de AccesoDocumentoApelacion.
 * Bitácora de descargas de evidencia (quién, cuándo, IP, user-agent).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class DocumentoApelacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Registra un acceso (descarga) a la evidencia documental. */
    registrarAcceso(data: Prisma.AccesoDocumentoApelacionUncheckedCreateInput) {
        return this.db.accesoDocumentoApelacion.create({ data });
    }
}
