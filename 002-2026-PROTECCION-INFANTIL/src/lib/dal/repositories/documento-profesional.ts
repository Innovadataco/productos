/**
 * SPEC-436 (I-304) · Repositorio de los documentos que carga el profesional.
 * Q-3: el acceso a Prisma vive acá; los services y los routes componen.
 */
import type { DocumentoProfesional, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class DocumentoProfesionalRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Sube o REEMPLAZA el documento de un requisito. Es un upsert sobre
     * `(perfilProfesionalId, requisitoClave)`: reemplazar no deja filas viejas
     * acumulándose ni deja dos documentos compitiendo por el mismo requisito.
     */
    guardar(datos: {
        perfilProfesionalId: string;
        requisitoClave: string;
        archivoId: string;
        extension: string;
        sha256: string;
    }): Promise<DocumentoProfesional> {
        const { perfilProfesionalId, requisitoClave, ...resto } = datos;
        return this.db.documentoProfesional.upsert({
            where: { perfilProfesionalId_requisitoClave: { perfilProfesionalId, requisitoClave } },
            update: { ...resto, subidoEn: new Date() },
            create: { perfilProfesionalId, requisitoClave, ...resto },
        });
    }

    listarPorPerfil(perfilProfesionalId: string): Promise<DocumentoProfesional[]> {
        return this.db.documentoProfesional.findMany({
            where: { perfilProfesionalId },
            orderBy: { requisitoClave: "asc" },
        });
    }

    buscar(perfilProfesionalId: string, requisitoClave: string): Promise<DocumentoProfesional | null> {
        return this.db.documentoProfesional.findUnique({
            where: { perfilProfesionalId_requisitoClave: { perfilProfesionalId, requisitoClave } },
        });
    }
}
