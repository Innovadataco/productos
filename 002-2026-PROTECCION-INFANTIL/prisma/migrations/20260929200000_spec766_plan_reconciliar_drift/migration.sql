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
-- Dos divergencias que el clasificador de 760 marca REAL contra prod:
--  a) `creadoEn` quedó como TIMESTAMP SIN zona — es la ÚNICA columna que la migración de I-420
--     (20260822010000) dejó afuera. El esquema la declara `@db.Timestamptz(3)`. Un `creadoEn` sin
--     zona en la tabla de logs, en un contenedor UTC, reporta horas mal. Conversión BARE (sin
--     `USING`), igual que I-420: en prod interpreta el naked como la TZ de sesión (UTC) → correcto;
--     en test (que ya es timestamptz(6)) baja la precisión a (3) preservando la zona. Un `USING AT
--     TIME ZONE 'UTC'` sería INCORRECTO en el caso ya-timestamptz (le quitaría la zona), por eso bare.
--  b) `id` tiene un DEFAULT `gen_random_uuid()` de la BD que el esquema NO declara (`@default(cuid())`,
--     lo genera la app). Es DRIFT REAL (no representación): Prisma siempre provee el id, así que
--     quitar el default de la BD no rompe inserts. OJO: `gen_random_uuid()` cae en el
--     `VALOR_DEFAULT_BENIGNO` del clasificador — un `SET DEFAULT gen_random_uuid()` aislado se
--     marcaría benigno (límite conocido del clasificador); acá NO se esconde porque la cláusula (a)
--     hace que el statement entero salga ROJO. Reportado aparte.
-- CAMBIA la base viva (a diferencia del createdAt de Plan, que es no-op): completa la conversión de
-- I-420 y quita el default. HALLAZGO si la reinterpretación naked→tz corre los timestamps (pasaría
-- solo si NO fueran UTC — el contenedor es UTC, misma premisa que I-420).
ALTER TABLE "worker_logs" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "worker_logs" ALTER COLUMN "creadoEn" SET DATA TYPE TIMESTAMPTZ(3);
