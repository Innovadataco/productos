// src/lib/bi/operacion.ts · Semáforo de colegios con datos REALES de la réplica
// Producto 006 · BI v2 · Operación (Fase 3)
//
// Fuente: tablas replicadas de PI en bi-db ("Colegio", "Reporte",
// "ClasificacionIA", "AlertaColegio", "Profesor", "Alumno" — copia lógica,
// solo lectura desde el 006).
// Columnas reales verificadas contra 002-2026-PROTECCION-INFANTIL/prisma/schema.prisma:
//   Colegio(id, nombre, tenantId, estado) · Reporte(tenantId, creadoEn, eliminado)
//   ClasificacionIA(reporteId, categoria)
//   AlertaColegio(colegioId, estado) · Profesor(colegioId, estado)
//   Alumno(colegioId, estado)
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
//   warn — ESCALADAS SIN GESTIÓN: tiene al menos una alerta de colegio en
//          estado 'escalada' (etiqueta propia "Escaladas sin gestión"; una
//          escalada sin resolver pesa más que la calma aparente);
//          O actividad reciente: último reporte dentro de las últimas
//          `operacion.horas_actividad_warn` horas (default 6);
//          O categoría sensible recurrente: la categoría más frecuente del
//          mes pertenece a `operacion.categorias_sensibles` (lista CSV de
//          valores del enum CategoriaConducta de PI) y suma al menos
//          `operacion.min_repeticion_categoria` reportes en el mes
//          (default 3).
//   ok   — el resto.
// Alertas por colegio: alertasActivas = estados 'nueva' + 'escalada' (lo
// que exige gestión); 'vista'/'gestionada'/'cerrada' ya no la exigen.
// Profesores/alumnos por colegio: solo filas con estado 'activo'.
// Solo colegios con estado 'activo' (los inactivos no son operación en vivo).

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

export interface FilaOperacion {
    colegio: string;
    reportesMes: number;
    hoy: number;
    categoriaTop: string | null;
    ultimoReporteHaceMin: number | null;
    /** Alertas del colegio que exigen gestión (estados 'nueva' + 'escalada') */
    alertasActivas: number;
    /** Alertas en estado 'escalada' (subconjunto de alertasActivas) */
    escaladas: number;
    /** Roster activo del colegio (Profesor/Alumno con estado 'activo') */
    profesores: number;
    alumnos: number;
    estado: "ok" | "warn" | "bad";
    estadoEtiqueta: string;
}

export interface ResumenOperacion {
    activos: number;
    enAtencion: number;
    sinActividad: number;
    reportesHoy: number;
    /** Colegios con ≥1 alerta por gestionar (nueva o escalada) */
    conAlertasPorGestionar: number;
    /** Colegios con ≥1 alerta escalada sin gestionar */
    conEscaladasSinGestion: number;
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

/** Etiqueta propia del warn por escaladas sin gestionar (ver semáforo). */
const ETIQUETA_ESCALADAS = "Escaladas sin gestión";

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

/** Alertas por colegio: activas (nueva+escalada) y escaladas. */
interface FilaAlertasColegio {
    colegio_id: string;
    alertas_activas: number;
    escaladas: number;
}

/** Rosters activos por colegio. */
interface FilaPersonasColegio {
    colegio_id: string;
    profesores: number;
    alumnos: number;
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

    // Alertas por colegio: activas = 'nueva' + 'escalada' (lo que exige
    // gestión). Un colegio sin filas en AlertaColegio no aparece aquí:
    // en el merge vale 0 (la ausencia de filas ES el conteo real en cero).
    const alertas = await prisma.$queryRaw<FilaAlertasColegio[]>`
        SELECT
            "colegioId"                                             AS colegio_id,
            COUNT(*) FILTER (WHERE "estado" IN ('nueva', 'escalada'))::int
                                                                    AS alertas_activas,
            COUNT(*) FILTER (WHERE "estado" = 'escalada')::int      AS escaladas
        FROM "AlertaColegio"
        GROUP BY "colegioId"
    `;

    // Rosters activos por colegio (subconsultas escalares: evitan el
    // producto cartesiano de dos LEFT JOIN independientes).
    const personas = await prisma.$queryRaw<FilaPersonasColegio[]>`
        SELECT
            c."id" AS colegio_id,
            (SELECT COUNT(*) FROM "Profesor" p
              WHERE p."colegioId" = c."id" AND p."estado" = 'activo')::int AS profesores,
            (SELECT COUNT(*) FROM "Alumno" a
              WHERE a."colegioId" = c."id" AND a."estado" = 'activo')::int AS alumnos
        FROM "Colegio" c
        WHERE c."estado" = ${"activo"}
    `;

    const alertasPorColegio = new Map(alertas.map((f) => [f.colegio_id, f]));
    const personasPorColegio = new Map(personas.map((f) => [f.colegio_id, f]));

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
        const alertasColegio = alertasPorColegio.get(a.colegio_id);
        const alertasActivas = alertasColegio?.alertas_activas ?? 0;
        const escaladas = alertasColegio?.escaladas ?? 0;
        const personasColegio = personasPorColegio.get(a.colegio_id);

        let estado: FilaOperacion["estado"];
        let estadoEtiqueta: string;
        if (ultimoReporteHaceMin === null || ultimoReporteHaceMin > minBad) {
            estado = "bad";
            estadoEtiqueta = ETIQUETAS.bad;
        } else if (escaladas > 0) {
            // Escalada sin gestionar: warn con etiqueta propia, aunque no
            // haya actividad reciente ni categoría sensible en el mes.
            estado = "warn";
            estadoEtiqueta = ETIQUETA_ESCALADAS;
        } else if (
            ultimoReporteHaceMin <= minWarn ||
            (top !== null &&
                sensibles.has(top.categoria) &&
                top.total >= umbrales.minRepeticionCategoria)
        ) {
            estado = "warn";
            estadoEtiqueta = ETIQUETAS.warn;
        } else {
            estado = "ok";
            estadoEtiqueta = ETIQUETAS.ok;
        }

        return {
            colegio: a.colegio,
            reportesMes: a.reportes_mes,
            hoy: a.hoy,
            categoriaTop: top?.categoria ?? null,
            ultimoReporteHaceMin,
            alertasActivas,
            escaladas,
            profesores: personasColegio?.profesores ?? 0,
            alumnos: personasColegio?.alumnos ?? 0,
            estado,
            estadoEtiqueta,
        };
    });

    const resumen: ResumenOperacion = {
        activos: filas.length,
        enAtencion: filas.filter((f) => f.estado === "warn").length,
        sinActividad: filas.filter((f) => f.estado === "bad").length,
        reportesHoy: filas.reduce((acc, f) => acc + f.hoy, 0),
        conAlertasPorGestionar: filas.filter((f) => f.alertasActivas > 0).length,
        conEscaladasSinGestion: filas.filter((f) => f.escaladas > 0).length,
    };

    return { filas, resumen };
}
