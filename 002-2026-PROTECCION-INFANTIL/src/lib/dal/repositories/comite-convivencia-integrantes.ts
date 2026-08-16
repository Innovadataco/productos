/**
 * SPEC-168 (Fase F): padrón documentado de integrantes del Comité de Convivencia.
 * El número de identificación se persiste cifrado con AES-256-GCM y solo se
 * descifra en lecturas autorizadas del rector de ese colegio.
 */
import { createHmac } from "crypto";
import type { Prisma, TipoIdentificacionIntegrante } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptParameter, decryptParameter, getEncryptionKey } from "@/lib/param-encryption";
import type { DbClient } from "../unit-of-work";

const SELECT_INTEGRANTE = {
    id: true,
    comiteId: true,
    nombres: true,
    apellidos: true,
    tipoIdentificacion: true,
    numeroIdentificacion: true,
    email: true,
    cargo: true,
    fechaInicio: true,
    fechaFin: true,
    estado: true,
    creadoPorId: true,
    modificadoPorId: true,
    creadoEn: true,
    actualizadoEn: true,
} satisfies Prisma.IntegranteComiteSelect;

export type IntegranteComiteRow = Prisma.IntegranteComiteGetPayload<{ select: typeof SELECT_INTEGRANTE }>;

export interface IntegranteComiteDescifrado {
    id: string;
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    email: string;
    cargo: string | null;
    fechaInicio: Date;
    fechaFin: Date | null;
    estado: string;
    creadoEn: Date;
    actualizadoEn: Date;
}

function cifrarDocumento(valor: string): string {
    return encryptParameter(valor);
}

function descifrarDocumento(valor: string): string {
    return decryptParameter(valor);
}

function hashIdentificacion(valor: string): string {
    const key = getEncryptionKey();
    if (!key) {
        throw new Error("PARAM_ENCRYPTION_KEY no configurada o inválida (se requieren 32 bytes)");
    }
    return createHmac("sha256", key).update(valor).digest("hex");
}

export class ComiteConvivenciaIntegrantesRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    private mapDescifrado(row: IntegranteComiteRow): IntegranteComiteDescifrado {
        return {
            ...row,
            numeroIdentificacion: descifrarDocumento(row.numeroIdentificacion),
        };
    }

    listarPorComite(comiteId: string): Promise<IntegranteComiteDescifrado[]> {
        return this.db.integranteComite
            .findMany({
                where: { comiteId },
                orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
                select: SELECT_INTEGRANTE,
            })
            .then((rows) => rows.map((r) => this.mapDescifrado(r)));
    }

    async obtenerPorId(id: string): Promise<IntegranteComiteDescifrado | null> {
        const row = await this.db.integranteComite.findUnique({
            where: { id },
            select: SELECT_INTEGRANTE,
        });
        return row ? this.mapDescifrado(row) : null;
    }

    async existeDocumentoEnComite(comiteId: string, numeroIdentificacion: string) {
        const row = await this.db.integranteComite.findFirst({
            where: { comiteId, hashIdentificacion: hashIdentificacion(numeroIdentificacion) },
            select: { id: true },
        });
        return row !== null;
    }

    crear(data: {
        comiteId: string;
        nombres: string;
        apellidos: string;
        tipoIdentificacion: TipoIdentificacionIntegrante;
        numeroIdentificacion: string;
        email: string;
        cargo: string;
        creadoPorId: string;
    }): Promise<IntegranteComiteDescifrado> {
        return this.db.integranteComite
            .create({
                data: {
                    ...data,
                    numeroIdentificacion: cifrarDocumento(data.numeroIdentificacion),
                    hashIdentificacion: hashIdentificacion(data.numeroIdentificacion),
                },
                select: SELECT_INTEGRANTE,
            })
            .then((row) => this.mapDescifrado(row));
    }

    actualizar(id: string, data: Prisma.IntegranteComiteUncheckedUpdateInput): Promise<IntegranteComiteDescifrado> {
        const payload = { ...data };
        if (typeof payload.numeroIdentificacion === "string") {
            const numeroPlano = payload.numeroIdentificacion;
            payload.numeroIdentificacion = cifrarDocumento(numeroPlano);
            payload.hashIdentificacion = hashIdentificacion(numeroPlano);
        }
        return this.db.integranteComite
            .update({
                where: { id },
                data: payload,
                select: SELECT_INTEGRANTE,
            })
            .then((row) => this.mapDescifrado(row));
    }
}
