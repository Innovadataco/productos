-- SPEC-766 (D-121) · reconciliar el DRIFT de "Plan" y "worker_logs" (historial↔esquema).
--
-- ⚠️ ESTE ARCHIVO FUE CORREGIDO EN SU LUGAR tras FALLAR en producción (29-09). La versión
-- original hacía `DROP COLUMN "Plan"."creadoEn"` y prod lo rechazó:
--   ERROR: cannot drop column creadoEn of table "Plan" because other objects depend on it
--   DETAIL: publication of table "Plan" in publication bi_replica depends on column creadoEn
--
-- POR QUÉ SE MODIFICA UNA MIGRACIÓN YA "aplicada" (normalmente PROHIBIDO — huérfana el ledger de
-- quien la aplicó). Tres hechos lo permiten acá, y van escritos para que nadie copie la excepción
-- sin la justificación:
--   1. FALLÓ en el entorno que importa: prod quedó con applied_steps_count=0 (ningún statement
--      corrió, la base intacta). No hay estado parcial que reescribir.
--   2. Se aplicó SOLO en un entorno DESECHABLE: la BD de test, que NO tiene la publicación, así que
--      el DROP no tenía quién lo bloqueara y sí corrió. Test se re-sincroniza (ver el PR).
--   3. Lleva pocas horas en main; ningún tercero estable la aplicó.
-- La recuperación de prod es `migrate resolve --rolled-back` + REINTENTO con este archivo corregido
-- (una migración NUEVA no sirve: `migrate deploy` no aplica ninguna posterior mientras la 200000
-- esté fallida en el ledger; marcarla `--applied` sería mentir —cero statements corrieron— y dejaría
-- prod sin el `precio DROP NOT NULL`).
--
-- 🔎 HALLAZGO NOMBRADO · NO-DETERMINISMO ENTRE ENTORNOS: el MISMO archivo dejó test y prod en
-- estados DISTINTOS —test SIN `Plan.creadoEn`, prod CON ella— porque prod tiene una PUBLICACIÓN
-- lógica (bi_replica) que test no tiene. Una migración NO es determinista entre entornos cuyo
-- CATÁLOGO de Postgres difiere (publicaciones, vistas, triggers). Es justo lo que el guardián de
-- SPEC-760 existe para cazar. Corolario: el barrido de dependientes corre contra la base VIVA que
-- recibe la migración; medir contra una fresca —o una sin publicaciones— es inconcluyente por clase.
--
-- ── (b) RECONCILIAR POR EL ESQUEMA, NO por DROP (dictamen del CEO) ──────────────────────────────
-- `creadoEn` se DECLARA en el esquema (Plan.creadoEn @default(now())) y se CONSERVA en la base; el
-- drift se cierra por el esquema, no bajando la base. Se le agrega default (la base era NOT NULL SIN
-- default → rompía `Plan.create()`) y se CANDA contra uso nuevo
-- (src/lib/pagos/plan-creadoen-no-uso.candado.test.ts, en este mismo PR).
-- La salida (a) —sacar creadoEn del whitelist como limpieza de minimización— es tarea de BI CUANDO
-- TENGA DUEÑO, no deuda perdida: la publicación es un control Ley 1581 que aplica Jelkin.
--
-- BARRIDO DE DEPENDIENTES DE BASE (regla post-fallo; medido contra la BD viva de test + el whitelist
-- del repo `006/scripts/replica-setup/02-pi-db-publicacion.sql`, fuente de la publicación de prod):
--   · Plan.creadoEn: en el whitelist (línea 164). NO se dropea (por eso falló). ADD/SET conservan la
--     columna → la publicación NO se toca.
--   · Plan.precio: pg_depend/pg_constraint/pg_index/pg_trigger → 0 (medido en test). En el whitelist;
--     DROP NOT NULL conserva la columna → publicación intacta.
--   · worker_logs.id: en el whitelist (línea 201: id,servicio,nivel,creadoEn); DROP DEFAULT conserva
--     la columna → publicación intacta. (pg_depend: solo el pkey.)
--   LÍMITE DECLARADO: el barrido de la clase «publicación» corrió contra test, que NO tiene
--   publicaciones; se apoya en el whitelist del repo (= la publicación de prod). No pude medir el
--   catálogo vivo de prod desde acá.
--
-- IDEMPOTENTE PARA LOS DOS ESTADOS DIVERGENTES (test: sin la columna / prod: con ella, sin default).

-- creadoEn · reconciliar por el esquema. ADD IF NOT EXISTS (test la re-agrega; prod no-op).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "creadoEn" TIMESTAMPTZ(6);
-- Backfill desde createdAt: en test las filas recién agregadas quedan NULL; en prod es no-op (ya NOT
-- NULL). createdAt es IDÉNTICA a creadoEn (medido por el CEO: 11 filas, 0 difieren) → backfill auditable.
UPDATE "Plan" SET "creadoEn" = "createdAt" WHERE "creadoEn" IS NULL;
-- Default: la base era NOT NULL SIN default y Prisma la exigiría en cada create(); el esquema declara
-- @default(now()) (= CURRENT_TIMESTAMP). Cierra el drift por ambos lados.
ALTER TABLE "Plan" ALTER COLUMN "creadoEn" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Plan" ALTER COLUMN "creadoEn" SET NOT NULL;

-- precio · nulable (el esquema lo declara Float?, legacy). Idempotente: no-op si ya es nulable.
ALTER TABLE "Plan" ALTER COLUMN "precio" DROP NOT NULL;

-- worker_logs.id · sin default de BD (el esquema lo genera con cuid() en la app). Idempotente: no-op
-- si ya no tiene default. Nota: un `SET DEFAULT gen_random_uuid()` aislado sería benigno para el
-- clasificador de SPEC-760 — límite ya declarado en LIMITES_CLASIFICADOR (#742).
ALTER TABLE "worker_logs" ALTER COLUMN "id" DROP DEFAULT;
