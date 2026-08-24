/**
 * SPEC-221 (002-PI-122): definición de las 7 reglas semilla del brief §8.2.
 * Datos puros (sin acceso a BD); los consume `prisma/seed.ts`
 * (`seedReglasRecomendacion`) y el test de integración que ejecuta las queries
 * contra la PostgreSQL de tests.
 *
 * Convención de columnas de salida de cada `sqlQuery`:
 * - `sujeto_tipo` (texto) y `sujeto_id`: identifican al sujeto polimórfico.
 * - `valor` (numérico): solo si la regla define `umbralMinimo`.
 * - El resto son variables de la `plantillaRecomendacion` (`{{...}}`).
 *
 * Candados: todas nacen en modo RECOMIENDA (D-77) y solo leen el dominio SaaS
 * (Suscripcion, Pago, Plan, Colegio, Ciudad, Usuario, CodigoReferidoUso);
 * jamás texto de reportes ni datos de menores.
 */

export interface ReglaSemilla {
    clave: string;
    nombre: string;
    descripcion: string;
    categoria: "renovacion" | "churn" | "crecimiento" | "anomalia";
    sqlQuery: string;
    plantillaRecomendacion: string;
    prioridad: number;
    frecuenciaMin: number;
    umbralMinimo?: number;
    accionEjecutable?: string;
}

const JOIN_CLIENTE = `
  LEFT JOIN "Colegio" c ON c.id = s."colegioId"
  LEFT JOIN "Usuario" u ON u.id = s."usuarioId"
  JOIN "Plan" p ON p.id = s."planActualId"`;

const CLIENTE_EXPR = "COALESCE(c.nombre, u.email, 'Cliente')";

export const REGLAS_SEMILLA: ReglaSemilla[] = [
    {
        clave: "vencimiento.T_menos_7",
        nombre: "Llamar a clientes que vencen esta semana",
        descripcion: "Suscripciones ACTIVA cuya fechaFin cae dentro de los próximos 7 días.",
        categoria: "renovacion",
        prioridad: 90,
        frecuenciaMin: 720,
        accionEjecutable: "llamar",
        sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       ${CLIENTE_EXPR} AS cliente,
       p.nombre AS plan,
       to_char(s."fechaFin" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha_fin,
       EXTRACT(DAY FROM s."fechaFin" - now())::int AS dias_restantes
FROM "Suscripcion" s
${JOIN_CLIENTE}
WHERE s.estado = 'ACTIVA'
  AND s."fechaFin" >= now()
  AND s."fechaFin" < now() + INTERVAL '7 days'`,
        plantillaRecomendacion: `Llamar a {{cliente}} · vence {{fecha_fin}}
La suscripción del plan {{plan}} vence en {{dias_restantes}} días. Contactar hoy para gestionar la renovación.`,
    },
    {
        clave: "mora.T_mas_30",
        nombre: "Gestionar suscripciones en mora de más de 30 días",
        descripcion: "Suscripciones SUSPENDIDA hace más de 30 días: candidatas a bono de retención o cierre.",
        categoria: "churn",
        prioridad: 80,
        frecuenciaMin: 720,
        accionEjecutable: "crear_bono_retencion",
        sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       ${CLIENTE_EXPR} AS cliente,
       p.nombre AS plan,
       to_char(s."suspendidaEn" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS suspendida_en,
       EXTRACT(DAY FROM now() - s."suspendidaEn")::int AS dias_en_mora
FROM "Suscripcion" s
${JOIN_CLIENTE}
WHERE s.estado = 'SUSPENDIDA'
  AND s."suspendidaEn" < now() - INTERVAL '30 days'`,
        plantillaRecomendacion: `Gestionar mora de {{cliente}} · {{dias_en_mora}} días
La suscripción del plan {{plan}} está suspendida desde {{suspendida_en}}. Evaluar bono de retención o cierre.`,
    },
    {
        clave: "padres_de_colegio_no_renovado",
        nombre: "Padres de un colegio que no renovó",
        descripcion:
            "Suscripciones PADRE activas cuyo usuario pertenece al tenant de un colegio con suscripción COLEGIO cancelada (vínculo vía Usuario.tenantId; tunable v1).",
        categoria: "churn",
        prioridad: 70,
        frecuenciaMin: 1440,
        accionEjecutable: "enviar_notificacion",
        sqlQuery: `
SELECT sp.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       c.nombre AS colegio,
       u.email AS padre,
       to_char(sc."canceladaEn" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS cancelada_en
FROM "Suscripcion" sp
JOIN "Usuario" u ON u.id = sp."usuarioId"
JOIN "Colegio" c ON c."tenantId" = u."tenantId"
JOIN "Suscripcion" sc ON sc."colegioId" = c.id
  AND sc."tipoTitular" = 'COLEGIO'
  AND sc.estado = 'CANCELADA'
WHERE sp."tipoTitular" = 'PADRE'
  AND sp.estado = 'ACTIVA'`,
        plantillaRecomendacion: `Padres del colegio {{colegio}} sin renovar
El colegio canceló su suscripción el {{cancelada_en}}; el padre {{padre}} mantiene su suscripción activa. Evaluar comunicación de continuidad.`,
    },
    {
        clave: "crecimiento_ciudad_anomalo",
        nombre: "Crecimiento anómalo por ciudad",
        descripcion:
            "Altas de suscripciones por ciudad, semana actual vs. anterior; dispara cuando la variación absoluta supera el umbral (%).",
        categoria: "anomalia",
        prioridad: 60,
        frecuenciaMin: 1440,
        umbralMinimo: 25,
        accionEjecutable: "crear_alerta_admin",
        sqlQuery: `
WITH semana_actual AS (
  SELECT c."ciudadId" AS ciudad_id, count(*)::int AS nuevas
  FROM "Suscripcion" s
  JOIN "Colegio" c ON c.id = s."colegioId"
  WHERE s."createdAt" >= date_trunc('week', now())
  GROUP BY c."ciudadId"
),
semana_previa AS (
  SELECT c."ciudadId" AS ciudad_id, count(*)::int AS nuevas
  FROM "Suscripcion" s
  JOIN "Colegio" c ON c.id = s."colegioId"
  WHERE s."createdAt" >= date_trunc('week', now()) - INTERVAL '7 days'
    AND s."createdAt" < date_trunc('week', now())
  GROUP BY c."ciudadId"
)
SELECT ci.id AS sujeto_id, 'Ciudad' AS sujeto_tipo,
       ci.nombre AS ciudad,
       COALESCE(sa.nuevas, 0) AS nuevas_semana_actual,
       COALESCE(sp.nuevas, 0) AS nuevas_semana_previa,
       ROUND((COALESCE(sa.nuevas, 0) - COALESCE(sp.nuevas, 0)) * 100.0
             / GREATEST(COALESCE(sp.nuevas, 0), 1))::float AS variacion_pct,
       ABS(ROUND((COALESCE(sa.nuevas, 0) - COALESCE(sp.nuevas, 0)) * 100.0
             / GREATEST(COALESCE(sp.nuevas, 0), 1)))::float AS valor
FROM "Ciudad" ci
LEFT JOIN semana_actual sa ON sa.ciudad_id = ci.id
LEFT JOIN semana_previa sp ON sp.ciudad_id = ci.id
WHERE COALESCE(sa.nuevas, 0) > 0 OR COALESCE(sp.nuevas, 0) > 0`,
        plantillaRecomendacion: `Crecimiento anómalo en {{ciudad}}
Altas semana actual: {{nuevas_semana_actual}} vs. {{nuevas_semana_previa}} la anterior (Δ {{variacion_pct}}%). Revisar la causa.`,
    },
    {
        clave: "cliente_puntual_ahora_atrasado",
        nombre: "Cliente históricamente puntual ahora atrasado",
        descripcion:
            "Suscripciones con al menos 2 pagos AUTORIZADO cuyo estado actual es EN_GRACIA o SUSPENDIDA.",
        categoria: "anomalia",
        prioridad: 75,
        frecuenciaMin: 720,
        accionEjecutable: "llamar",
        sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       ${CLIENTE_EXPR} AS cliente,
       p.nombre AS plan,
       s.estado::text AS estado_actual,
       count(pg.id)::int AS pagos_autorizados
FROM "Suscripcion" s
${JOIN_CLIENTE}
JOIN "Pago" pg ON pg."suscripcionId" = s.id AND pg.estado = 'AUTORIZADO'
WHERE s.estado IN ('EN_GRACIA', 'SUSPENDIDA')
GROUP BY s.id, c.nombre, u.email, p.nombre
HAVING count(pg.id) >= 2`,
        plantillaRecomendacion: `Cliente puntual ahora atrasado: {{cliente}}
Acumula {{pagos_autorizados}} pagos autorizados y hoy está en estado {{estado_actual}}. Contactar antes de escalar.`,
    },
    {
        clave: "alta_freemium_expira_manana",
        nombre: "Alta freemium que expira mañana",
        descripcion: "Suscripciones freemium cuyo freemiumFechaFin cae dentro de las próximas 24 horas.",
        categoria: "renovacion",
        prioridad: 85,
        frecuenciaMin: 360,
        accionEjecutable: "enviar_notificacion",
        sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       ${CLIENTE_EXPR} AS cliente,
       p.nombre AS plan,
       to_char(s."freemiumFechaFin" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS freemium_fin
FROM "Suscripcion" s
${JOIN_CLIENTE}
WHERE s."esFreemium" = true
  AND s."freemiumFechaFin" >= now()
  AND s."freemiumFechaFin" < now() + INTERVAL '1 day'`,
        plantillaRecomendacion: `Freemium de {{cliente}} expira mañana
El período freemium del plan {{plan}} termina {{freemium_fin}}. Ofrecer la conversión a plan pago hoy.`,
    },
    {
        clave: "nuevo_referido_registrado_sin_pagar_7d",
        nombre: "Referido registrado hace 7 días sin pagar",
        descripcion:
            "Suscripciones con codigoReferidoUsado, creadas hace más de 7 días y sin ningún pago AUTORIZADO.",
        categoria: "crecimiento",
        prioridad: 65,
        frecuenciaMin: 720,
        accionEjecutable: "enviar_notificacion",
        sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       ${CLIENTE_EXPR} AS cliente,
       s."codigoReferidoUsado" AS codigo_referido,
       EXTRACT(DAY FROM now() - s."createdAt")::int AS dias_sin_pagar
FROM "Suscripcion" s
${JOIN_CLIENTE}
WHERE s."codigoReferidoUsado" IS NOT NULL
  AND s."createdAt" < now() - INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM "Pago" pg
    WHERE pg."suscripcionId" = s.id AND pg.estado = 'AUTORIZADO'
  )`,
        plantillaRecomendacion: `Referido sin pagar hace {{dias_sin_pagar}} días: {{cliente}}
Se registró con el código {{codigo_referido}} y aún no tiene pago autorizado. Acompañar la activación.`,
    },
];
