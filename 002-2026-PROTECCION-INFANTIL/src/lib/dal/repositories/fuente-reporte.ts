/**
 * E-8 (002-PI-056): repositorio de FuenteReporte (señal anti-abuso).
 * La lógica de hash/fingerprint/where queda en `src/lib/anti-abuso/fuente-reporte.ts`;
 * aquí vive SOLO el acceso a datos. Dominio global (sin tenant). Acepta tx (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class FuenteReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Conteo de reportes por un where ya construido (historial y ráfaga de la fuente). */
    contarPorWhere(where: Prisma.ReporteWhereInput): Promise<number> {
        return this.db.reporte.count({ where });
    }

    /** Reporte del que depende el cálculo de peso (falla si no existe, como findUniqueOrThrow). */
    obtenerReporteOFallo(reporteId: string) {
        return this.db.reporte.findUniqueOrThrow({ where: { id: reporteId } });
    }

    /** Persiste el peso calculado de la fuente en el propio reporte. */
    actualizarFuenteConfianza(reporteId: string, peso: number) {
        return this.db.reporte.update({ where: { id: reporteId }, data: { fuenteConfianza: peso } });
    }

    /** Purga por retención: borra señales anteriores al límite y devuelve cuántas. */
    purgarAntiguas(limite: Date): Promise<number> {
        return this.db.fuenteReporte.deleteMany({ where: { creadoEn: { lt: limite } } }).then((r) => r.count);
    }

    crear(data: Prisma.FuenteReporteUncheckedCreateInput) {
        return this.db.fuenteReporte.create({ data });
    }
}
