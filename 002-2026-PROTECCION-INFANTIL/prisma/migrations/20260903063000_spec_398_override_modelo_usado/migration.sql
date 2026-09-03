-- SPEC-398 (I-286) — Bandera de override intencional en ClasificacionIA.
--
-- El pipeline real vota con el comité de `ia.rubrica.modelos`; el sandbox de
-- A/B del admin corre sobre reportes reales y pide un modelo puntual. Sin
-- distinguir los dos casos, la alarma `senalJuradoReducido` (SPEC-378) no
-- puede diferenciar "el jurado se degradó" de "alguien probó un modelo".
--
-- Migración ADITIVA e IDEMPOTENTE. Backfill implícito: `NULL` para todas las
-- filas existentes — es lo correcto. Las 52 clasificaciones históricas eran
-- el defecto del pipeline (no overrides intencionales), y la alarma DEBE
-- gritar por ellas hasta que salgan del rango por edad. Así se prueba en
-- vivo que el candado funciona.
ALTER TABLE "ClasificacionIA"
    ADD COLUMN IF NOT EXISTS "overrideModeloUsado" TEXT;
