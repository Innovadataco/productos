-- ==========================================================================
-- 07-bi-db-limpieza-legacy.sql · Producto 006 · BI v2
-- Limpieza de shells LEGACY en la RÉPLICA (bi-db), después de que el script
-- 02 retiró Subscription, BillingCycle y AlertaSuscripcion de la publicación
-- bi_replica en el master.
--
-- DÓNDE CORRE: en bi-db (SUSCRIPTOR), DESPUÉS de:
--   1) correr 02-pi-db-publicacion.sql en pi-db (quita las 3 del canon y de
--      la publicación);
--   2) correr ALTER SUBSCRIPTION bi006_replica_sub REFRESH PUBLICATION en
--      bi-db (la suscripción deja de recibir esas tablas).
-- Este script hace AMBAS cosas: el REFRESH y el DROP de las shells.
--
-- CONTEXTO: esas 3 tablas eran placeholder vacías del 005 (0 filas en PI y
--   en la réplica — verificado 2026-09-01). Al salir de la publicación, en
--   bi-db quedan como tablas huérfanas que ya no reciben cambios: shells
--   vacíos que solo confunden. Aquí se dropean.
--   (FuenteReporte iba en esta lista, pero el guard del 02 la detectó con 19
--   filas reales — antifraude de PI activo — y se quedó en el canon.)
--
-- GUARD B1 (falla EN VOZ ALTA): cada tabla se dropea SOLO si tiene 0 filas.
--   Si alguna tuviera datos, aborta sin tocar nada — conservar o migrar esos
--   datos es decisión humana.
--
-- IDEMPOTENTE: DROP TABLE IF EXISTS; correrlo dos veces es inofensivo.
-- ==========================================================================

-- 1. La suscripción deja de seguir las tablas retiradas del canon.
ALTER SUBSCRIPTION bi006_replica_sub REFRESH PUBLICATION;

-- 2. Retiro de 2 MVs muertas que dependen de las legacy (ambas construidas sobre tablas legacy
--    vacías y NO usadas por la app ni por el catálogo NL→SQL):
--      · mv_fact_comercial_mensual  (FROM BillingCycle LEFT JOIN Subscription …)
--      · mv_fact_salud_sistema     (LEFT JOIN AlertaSuscripcion)
--    Guard: solo si existen (idempotente). Si en el futuro se quiere analítica comercial,
--    se reconstruye sobre Suscripcion (viva) — decisión de diseño propia, no Lote 3.
DROP MATERIALIZED VIEW IF EXISTS mv_fact_comercial_mensual;
DROP MATERIALIZED VIEW IF EXISTS mv_fact_salud_sistema;

DO $limpieza$
DECLARE
  t       text;
  n_filas bigint;
  legacy  text[] := ARRAY['Subscription', 'BillingCycle', 'AlertaSuscripcion'];
BEGIN
  FOREACH t IN ARRAY legacy LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE '[07] % ya no existe en bi-db — nada que hacer', t;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n_filas;
    IF n_filas > 0 THEN
      RAISE EXCEPTION '[07] La tabla legacy % tiene % filas en bi-db — abortando. Conservar o migrar esos datos es decisión humana.', t, n_filas;
    END IF;

    EXECUTE format('DROP TABLE public.%I', t);
    RAISE NOTICE '[07] Shell legacy vacío dropeado en bi-db: %', t;
  END LOOP;
END $limpieza$;

-- Resumen: ya NO deben aparecer las 3 legacy.
SELECT tablename
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('Subscription', 'BillingCycle', 'AlertaSuscripcion')
 ORDER BY 1;
-- Esperado: 0 filas.

