-- SPEC-766 (D-121) · reconciliar el DRIFT de "Plan" que el clasificador de SPEC-760 cazó.
--
-- Estado medido (BD viva, mismo en prod y test): "Plan" tiene la columna LEGACY "creadoEn"
-- (NOT NULL) y "precio" NOT NULL — ninguna de las dos la declara el esquema. El esquema declara
-- "createdAt" (que YA lo crea la migración 20260822130816_pagos_modelos_base, línea 24) y
-- "precio" NULABLE ("legacy placeholder; no usar en lógica nueva"). Es decir: `init` creó
-- creadoEn + precio NOT NULL; 20260822 agregó createdAt pero CONSERVÓ creadoEn; el esquema
-- renombró conceptualmente creadoEn→createdAt e hizo precio nulable, pero NINGUNA migración lo
-- reflejó → el historial produce una base que NO coincide con el esquema (lo que traba el
-- guardián historial↔esquema de SPEC-767).
--
-- Esta migración hace que el HISTORIAL cuente lo que el esquema declara:
--   1) DROP creadoEn      — columna legacy, el esquema no la tiene; Prisma no la expone, ningún
--                            código la lee. `createdAt` es la fuente vigente. IF EXISTS: idempotente.
--   2) precio DROP NOT NULL — el esquema lo declara `Float?` (legacy, sin uso en lógica nueva).
--   3) ADD createdAt IF NOT EXISTS — reparación de HISTORIAL, no de esquema: `createdAt` ya existe
--      en toda base que corrió 20260822130816, así que en la BD viva es NO-OP (IF NOT EXISTS).
--      Se incluye como cinturón por si algún entorno lo tuviera fuera de las migraciones.
-- Aditiva salvo el DROP del legacy medido; si al correr contra prod se altera algo MÁS que quitar
-- creadoEn + relajar precio, es HALLAZGO y se para (createdAt debe ser no-op).

ALTER TABLE "Plan" DROP COLUMN IF EXISTS "creadoEn";
ALTER TABLE "Plan" ALTER COLUMN "precio" DROP NOT NULL;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── worker_logs (2ª tabla del drift, medida por el CEO contra prod) ──
-- `id` tiene un DEFAULT `gen_random_uuid()` de la BD que el esquema NO declara (`@default(cuid())`,
-- lo genera la app). DRIFT REAL: el default de BD está MUERTO (Prisma siempre provee el id), así que
-- quitarlo no rompe inserts; alinea la base con el esquema (historial↔esquema). OJO: `gen_random_uuid()`
-- cae en `VALOR_DEFAULT_BENIGNO` del clasificador — un `SET DEFAULT gen_random_uuid()` aislado se
-- marcaría benigno (límite conocido, va al registro de límites del guardián).
--
-- `creadoEn` NO se toca en la migración: su drift es historial↔ESQUEMA (no BD-viva↔historial). El
-- esquema declara `@db.Timestamptz(3)` (intención original de 20260821), pero I-420 (20260822) la
-- convirtió a `tz(6)` junto con TODO el resto — tz(6) es la convención del esquema entero. Prod y test
-- YA son tz(6), fieles a sus migraciones. En vez de bajar la BD a tz(3) (truncar precisión de un dato
-- vivo sin motivo), se corrige el ESQUEMA a tz(6) (el que quedó fuera de sincronía es él). Cero cambio
-- de dato; el diff historial↔esquema se cierra por el lado del esquema. (Ver el schema.prisma de este PR.)
ALTER TABLE "worker_logs" ALTER COLUMN "id" DROP DEFAULT;
