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
