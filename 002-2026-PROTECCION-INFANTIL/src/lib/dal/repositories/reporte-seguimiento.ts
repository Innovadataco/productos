/**
 * SPEC-324 (/seguimiento · "otros reportes"): consultas de Reporte para la
 * pantalla pública de seguimiento. Extraído de `ReporteRepository` para respetar
 * el límite de tamaño de archivo (max-lines), mismo patrón que
 * `reporte-operador.ts`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class ReporteSeguimientoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Los OTROS reportes del mismo identificador, con el mínimo absoluto de campos.
     *
     * El `select` ES la barrera de privacidad (Ley 1581), no el mapeo posterior:
     * de aquí NO salen `texto`, `usuarioId` ni `esAnonimo`, así que el payload no
     * puede filtrar autor ni contenido aunque el mapeo cambie después. Mismo
     * límite duro que el bloque "otros" del expediente (SPEC-323 US3).
     */
    findOtrosPorIdentificador(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.findMany({
            where,
            select: {
                id: true,
                creadoEn: true,
                pais: true,
                ciudad: true,
                ciudadRel: { select: { nombre: true } },
                clasificacion: { select: { categoria: true } },
                // SPEC-439: el TIPO de autor (anónimo vs padre autenticado), nunca su
                // identidad. `usuarioId` NO se selecciona a propósito: no puede salir
                // de acá ni por error. `cadenas-padre` ya lo hacía así.
                esAnonimo: true,
            },
            orderBy: { creadoEn: "desc" },
            take: 50,
        });
    }
}
