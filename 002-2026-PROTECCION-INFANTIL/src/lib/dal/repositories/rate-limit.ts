/**
 * SPEC-184 (002-PI-079): repositorio de agregados de RateLimit.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface IpBloqueadaRow {
    identifier: string;
    bloqueos: number;
    ultimoBloqueoEn: Date | null;
}

export class RateLimitRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Top IPs (identifiers con formato IPv4) bloqueadas en la ventana.
     * El conteo de "bloqueos" se aproxima como sum(max(0, count - maxRequests))
     * usando el maxRequests actual del scope.
     */
    async topIpsBloqueadas(
        scope: string,
        desde: Date,
        maxRequests: number,
        limite: number
    ): Promise<IpBloqueadaRow[]> {
        const rows = await this.db.$queryRaw<
            { identifier: string; bloqueos: bigint; ultimoBloqueoEn: Date | null }[]
        >`
            SELECT
                identifier,
                SUM(GREATEST(count - ${maxRequests}, 0)) AS bloqueos,
                MAX("windowStart") AS "ultimoBloqueoEn"
            FROM "RateLimit"
            WHERE scope = ${scope}
              AND "windowStart" >= ${desde}
              AND identifier ~ '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'
            GROUP BY identifier
            HAVING SUM(GREATEST(count - ${maxRequests}, 0)) > 0
            ORDER BY bloqueos DESC
            LIMIT ${limite}
        `;
        return rows.map((r) => ({
            identifier: r.identifier,
            bloqueos: Number(r.bloqueos),
            ultimoBloqueoEn: r.ultimoBloqueoEn,
        }));
    }

    /**
     * Total de bloqueos de una IP (identifier) en el rango dado.
     * Usa maxRequests actual como aproximación.
     */
    async contarBloqueosPorIpEnRango(
        identifier: string,
        scope: string,
        desde: Date,
        maxRequests: number
    ): Promise<number> {
        const rows = await this.db.$queryRaw<{ bloqueos: bigint }[]>`
            SELECT COALESCE(SUM(GREATEST(count - ${maxRequests}, 0)), 0) AS bloqueos
            FROM "RateLimit"
            WHERE identifier = ${identifier}
              AND scope = ${scope}
              AND "windowStart" >= ${desde}
        `;
        return Number(rows[0]?.bloqueos ?? 0);
    }
}
