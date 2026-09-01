// src/lib/bi/operacion.ts · Semáforo de colegios con datos REALES de la réplica
// Producto 006 · BI v2 · Operación (Fase 3)
//
// Fuente: tablas replicadas de PI en bi-db ("Colegio", "Reporte",
// "ClasificacionIA" — copia lógica, solo lectura desde el 006).
// Columnas reales verificadas contra 002-2026-PROTECCION-INFANTIL/prisma/schema.prisma:
//   Colegio(id, nombre, tenantId, estado) · Reporte(tenantId, creadoEn, eliminado)
//   ClasificacionIA(reporteId, categoria)
//
// Candados:
//   9  — honestidad con el vacío: sin reportes → categoriaTop null,
//        ultimoReporteHaceMin null; la UI muestra "—" / "sin reportes",
//        jamás una cifra inventada.
//   10 — TODA cifra sale del ResultSet; aquí no hay ni un número quemado.
//   B3 — umbrales en bi_config (editables sin despliegue), con default
//        documentado solo como último fallback (patrón de src/lib/config.ts).
//
// SEMÁFORO DETERMINISTA (en este orden, gana el primero que aplica):
//   bad  — el colegio NUNCA tuvo reportes, o su último reporte tiene más de
//          `operacion.dias_sin_actividad_bad` días (default 30).
//   warn — actividad reciente: último reporte dentro de las últimas
//          `operacion.horas_actividad_warn` horas (default 6); O categoría
//          sensible recurrente: la categoría más frecuente del mes pertenece
//          a `operacion.categorias_sensibles` (lista CSV de valores del enum
//          CategoriaConducta de PI) y suma al menos
//          `operacion.min_repeticion_categoria` reportes en el mes (default 3).
//   ok   — el resto.
// Solo colegios con estado 'activo' (los inactivos no son operación en vivo).

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

export interface FilaOperacion {
    colegio: string;
    reportesMes: number;
    hoy: number;
    categoriaTop: string | null;
    ultimoReporteHaceMin: number | null;
    estado: "ok" | "warn" | "bad";
    estadoEtiqueta: string;
}

export interface ResumenOperacion {
    activos: number;
    enAtencion: number;
    sinActividad: number;
    reportesHoy: number;
}

export interface DatosOperacion {
    filas: FilaOperacion[];
    resumen: ResumenOperacion;
}

/** Umbrales del semáforo ya resueltos (bi_config → default). */
interface Umbrales {
    diasSinActividadBad: number;
    horasActividadWarn: number;
    minutosBadgeNuevo: number;
    minRepeticionCategoria: number;
    categoriasSensibles: string[];
}

// Defaults documentados (último eslabón del patrón BD → default de config.ts).
const DEFAULTS: Umbrales = {
    diasSinActividadBad: 30,
    horasActividadWarn: 6,
    minutosBadgeNuevo: 120,
    minRepeticionCategoria: 3,
    // Subconjunto del enum CategoriaConducta de PI asociado a riesgo sexual/depredación.
    categoriasSensibles: [
        "SOLICITUD_MATERIAL",
        "COMPARTIMIENTO_SEXUAL",
        "DIFUSION_NO_CONSENTIDA",
        "SOLICITUD_ENCUENTRO",
        "EXTORSION",
    ],
};

const ETIQUETAS: Record<FilaOperacion["estado"], string> = {
    ok: "En calma",
    warn: "En atención",
    bad: "Sin actividad",
};

/** Fila del agregado por colegio (counts casteados a int en SQL → number). */
interface FilaAgregada {
    colegio_id: string;
    colegio: string;
    tenant_id: string;
    reportes_mes: number;
    hoy: number;
    ultimo_reporte: Date | null;
}

/** Conteo por categoría del mes, por tenant. */
interface FilaCategoria {
    tenant_id: string;
    categoria: string;
    total: number;
}

function enteroPositivo(valor: string | null, fallback: number): number {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Lee los umbrales de bi_config con fallback a DEFAULTS (B3). */
async function leerUmbrales(): Promise<Umbrales> {
    const [diasBad, horasWarn, minNuevo, minRep, sensibles] = await Promise.all([
        getConfig("operacion.dias_sin_actividad_bad"),
        getConfig("operacion.horas_actividad_warn"),
        getConfig("operacion.minutos_badge_nuevo"),
        getConfig("operacion.min_repeticion_categoria"),
        getConfig("operacion.categorias_sensibles"),
    ]);
    const lista = sensibles
        ?.split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return {
        diasSinActividadBad: enteroPositivo(diasBad, DEFAULTS.diasSinActividadBad),
        horasActividadWarn: enteroPositivo(horasWarn, DEFAULTS.horasActividadWarn),
        minutosBadgeNuevo: enteroPositivo(minNuevo, DEFAULTS.minutosBadgeNuevo),
        minRepeticionCategoria: enteroPositivo(minRep, DEFAULTS.minRepeticionCategoria),
        categoriasSensibles:
            lista && lista.length > 0 ? lista : DEFAULTS.categoriasSensibles,
    };
}

/**
 * Umbral (en minutos) del badge NUEVO de la tabla: actividad más reciente que
 * esto se marca como recién llegada. Lo consume la página para pasarlo al
 * componente cliente sin duplicar la lectura de config allá.
 */
export async function getMinutosBadgeNuevo(): Promise<number> {
    const valor = await getConfig("operacion.minutos_badge_nuevo");
    return enteroPositivo(valor, DEFAULTS.minutosBadgeNuevo);
}

/**
 * Semáforo de colegios: agregados del mes calendario y de hoy por colegio,
 * categoría más frecuente del mes y minutos desde el último reporte.
 * Queries $queryRaw parametrizadas (valores SIEMPRE como $1..$n; los
 * identificadores de tabla/columna van citados, nunca interpolados).
 */
export async function getOperacion(): Promise<DatosOperacion> {
    const umbrales = await leerUmbrales();

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    // Agregados por colegio (LEFT JOIN: un colegio sin reportes también es fila,
    // con conteos 0 y ultimo_reporte NULL — candado 9).
    // ${...} lo convierte Prisma en parámetro enlazado ($1, $2, ...): ningún
    // valor se interpola como texto en el SQL.
    const agregados = await prisma.$queryRaw<FilaAgregada[]>`
        SELECT
            c."id"                                    AS colegio_id,
            c."nombre"                                AS colegio,
            c."tenantId"                              AS tenant_id,
            COUNT(r."id") FILTER (WHERE r."creadoEn" >= ${inicioMes})::int AS reportes_mes,
            COUNT(r."id") FILTER (WHERE r."creadoEn" >= ${inicioHoy})::int AS hoy,
            MAX(r."creadoEn")                         AS ultimo_reporte
        FROM "Colegio" c
        LEFT JOIN "Reporte" r
            ON r."tenantId" = c."tenantId"
            AND r."eliminado" = false
        WHERE c."estado" = ${"activo"}
        GROUP BY c."id", c."nombre", c."tenantId"
        ORDER BY reportes_mes DESC, c."nombre" ASC
    `;

    // Conteo por categoría del mes (solo reportes clasificados; sin
    // clasificación NO hay categoría top — no se inventa).
    const categorias = await prisma.$queryRaw<FilaCategoria[]>`
        SELECT
            r."tenantId"              AS tenant_id,
            ci."categoria"::text      AS categoria,
            COUNT(*)::int             AS total
        FROM "Reporte" r
        JOIN "ClasificacionIA" ci ON ci."reporteId" = r."id"
        WHERE r."eliminado" = false
            AND r."creadoEn" >= ${inicioMes}
        GROUP BY r."tenantId", ci."categoria"
    `;

    // Top por tenant: más reportes del mes; empate → orden alfabético
    // (determinista, misma query = mismo resultado).
    const topPorTenant = new Map<string, { categoria: string; total: number }>();
    for (const fila of categorias) {
        const actual = topPorTenant.get(fila.tenant_id);
        if (
            !actual ||
            fila.total > actual.total ||
            (fila.total === actual.total && fila.categoria < actual.categoria)
        ) {
            topPorTenant.set(fila.tenant_id, {
                categoria: fila.categoria,
                total: fila.total,
            });
        }
    }

    const sensibles = new Set(umbrales.categoriasSensibles);
    const minBad = umbrales.diasSinActividadBad * 24 * 60;
    const minWarn = umbrales.horasActividadWarn * 60;

    const filas: FilaOperacion[] = agregados.map((a) => {
        const ultimoReporteHaceMin =
            a.ultimo_reporte === null
                ? null
                : Math.max(
                      0,
                      Math.floor(
                          (ahora.getTime() - a.ultimo_reporte.getTime()) / 60000,
                      ),
                  );
        const top = topPorTenant.get(a.tenant_id) ?? null;

        let estado: FilaOperacion["estado"];
        if (ultimoReporteHaceMin === null || ultimoReporteHaceMin > minBad) {
            estado = "bad";
        } else if (
            ultimoReporteHaceMin <= minWarn ||
            (top !== null &&
                sensibles.has(top.categoria) &&
                top.total >= umbrales.minRepeticionCategoria)
        ) {
            estado = "warn";
        } else {
            estado = "ok";
        }

        return {
            colegio: a.colegio,
            reportesMes: a.reportes_mes,
            hoy: a.hoy,
            categoriaTop: top?.categoria ?? null,
            ultimoReporteHaceMin,
            estado,
            estadoEtiqueta: ETIQUETAS[estado],
        };
    });

    const resumen: ResumenOperacion = {
        activos: filas.length,
        enAtencion: filas.filter((f) => f.estado === "warn").length,
        sinActividad: filas.filter((f) => f.estado === "bad").length,
        reportesHoy: filas.reduce((acc, f) => acc + f.hoy, 0),
    };

    return { filas, resumen };
}
