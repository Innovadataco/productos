/**
 * SPEC-234 (002-PI-134): lectura/recálculo de la señal comunitaria.
 * La caché se invalida desde `compilarExpediente`; si no existe o está inválida,
 * se recalcula inline con SQL puro y se persiste.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/dal/prisma.ts";
import type { DbClient } from "@/lib/dal/unit-of-work";
import { SenalComunitariaRepository } from "@/lib/dal/repositories/senal-comunitaria-repository";

export interface SenalComunitariaData {
    identificadorReportado: string;
    totalExpedientesActivos: number;
    totalExpedientesCerrados: number;
    totalExpedientesEscalados: number;
    categoriasFrecuenciaJson: Record<string, number>;
    primeraAparicionEn: Date;
    ultimaAparicionEn: Date;
    paisesJson: Record<string, number>;
    ciudadesJson: Record<string, number>;
    plataformasJson: Record<string, number>;
    invalidado: boolean;
    actualizadoEn: Date;
}

function contarPorClave<T extends { clave: string; total: number }>(rows: T[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) {
        if (r.clave) out[r.clave] = Number(r.total);
    }
    return out;
}

async function recalcularSenalComunitaria(
    identificadorReportado: string,
    client: DbClient
): Promise<SenalComunitariaData> {
    const ahora = new Date();

    const [totales] = await client.$queryRaw<
        {
            activos: number;
            cerrados: number;
            escalados: number;
        }[]
    >`
        SELECT
            COUNT(*) FILTER (WHERE estado = 'ACTIVO')::int AS activos,
            COUNT(*) FILTER (WHERE estado = 'CERRADO')::int AS cerrados,
            COUNT(*) FILTER (WHERE estado = 'ESCALADO')::int AS escalados
        FROM "Expediente"
        WHERE "identificadorReportado" = ${identificadorReportado}
    `;

    const [fechas] = await client.$queryRaw<
        { primeraAparicionEn: Date | null; ultimaAparicionEn: Date | null }[]
    >`
        SELECT
            MIN("fechaEvento") AS "primeraAparicionEn",
            MAX("fechaEvento") AS "ultimaAparicionEn"
        FROM "EventoExpediente"
        INNER JOIN "Expediente" ON "EventoExpediente"."expedienteId" = "Expediente".id
        WHERE "Expediente"."identificadorReportado" = ${identificadorReportado}
    `;

    const categorias = await client.$queryRaw<{ clave: string; total: number }[]>`
        SELECT
            COALESCE("categoriaDetectada", 'SIN_CATEGORIA') AS clave,
            COUNT(*)::int AS total
        FROM "EventoExpediente"
        INNER JOIN "Expediente" ON "EventoExpediente"."expedienteId" = "Expediente".id
        WHERE "Expediente"."identificadorReportado" = ${identificadorReportado}
        GROUP BY "categoriaDetectada"
    `;

    const plataformas = await client.$queryRaw<{ clave: string; total: number }[]>`
        SELECT
            COALESCE("EventoExpediente".plataforma, 'SIN_PLATAFORMA') AS clave,
            COUNT(*)::int AS total
        FROM "EventoExpediente"
        INNER JOIN "Expediente" ON "EventoExpediente"."expedienteId" = "Expediente".id
        WHERE "Expediente"."identificadorReportado" = ${identificadorReportado}
          AND "EventoExpediente".plataforma IS NOT NULL
        GROUP BY "EventoExpediente".plataforma
    `;

    const paisesCiudades = await client.$queryRaw<
        { paises: Record<string, number>; ciudades: Record<string, number> }[]
    >`
        SELECT
            jsonb_object_agg(COALESCE(r.pais, 'SIN_PAIS'), cnt ORDER BY cnt DESC) FILTER (WHERE r.pais IS NOT NULL) AS paises,
            jsonb_object_agg(COALESCE(r.ciudad, 'SIN_CIUDAD'), cnt ORDER BY cnt DESC) FILTER (WHERE r.ciudad IS NOT NULL) AS ciudades
        FROM (
            SELECT r.pais, r.ciudad, COUNT(*)::int AS cnt
            FROM "EventoExpediente" e
            INNER JOIN "Expediente" ex ON e."expedienteId" = ex.id
            INNER JOIN "Reporte" r ON e."reporteId" = r.id
            WHERE ex."identificadorReportado" = ${identificadorReportado}
            GROUP BY r.pais, r.ciudad
        ) r
    `;

    const paisesJson = paisesCiudades[0]?.paises ?? {};
    const ciudadesJson = paisesCiudades[0]?.ciudades ?? {};

    const data: SenalComunitariaData = {
        identificadorReportado,
        totalExpedientesActivos: totales?.activos ?? 0,
        totalExpedientesCerrados: totales?.cerrados ?? 0,
        totalExpedientesEscalados: totales?.escalados ?? 0,
        categoriasFrecuenciaJson: contarPorClave(categorias),
        primeraAparicionEn: fechas?.primeraAparicionEn ?? ahora,
        ultimaAparicionEn: fechas?.ultimaAparicionEn ?? ahora,
        paisesJson,
        ciudadesJson,
        plataformasJson: contarPorClave(plataformas),
        invalidado: false,
        actualizadoEn: ahora,
    };

    const repo = new SenalComunitariaRepository(
        client === prisma ? undefined : (client as Prisma.TransactionClient)
    );
    await repo.guardarCache(data);
    return data;
}

export async function obtenerSenalComunitaria(
    identificadorReportado: string,
    client: DbClient = prisma
): Promise<SenalComunitariaData> {
    const repo = new SenalComunitariaRepository(
        client === prisma ? undefined : (client as Prisma.TransactionClient)
    );
    const cache = await repo.obtenerPorIdentificador(identificadorReportado);

    if (cache && !cache.invalidado) {
        return {
            ...cache,
            categoriasFrecuenciaJson: (cache.categoriasFrecuenciaJson as Record<string, number>) ?? {},
            paisesJson: (cache.paisesJson as Record<string, number>) ?? {},
            ciudadesJson: (cache.ciudadesJson as Record<string, number>) ?? {},
            plataformasJson: (cache.plataformasJson as Record<string, number>) ?? {},
        };
    }

    return recalcularSenalComunitaria(identificadorReportado, client);
}
