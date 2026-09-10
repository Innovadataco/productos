-- I-366 · Cripto-shred COMPLETO: purgar las copias de texto bajo la llave global vieja.
--
-- SPEC-581 fue ADITIVA (correcta — un DROP con filas aborta/pierde datos, D-125): dejó
-- `Reporte.texto`, `Reporte.textoOriginal` y `EventoExpediente.texto` INTACTAS en la BD
-- (Prisma ya no las mapea) tras backfillear el relato a `ContenidoReporte` (DEK por fila).
-- Consecuencia: las filas pre-backfill tienen DOS copias y quemar la DEK NO destruye la vieja
-- (shred parcial e invisible). Jelkin (2026-09-10) decidió borrarlas — esta migración es el
-- paso final que la 581 planeó («drop DESPUÉS del backfill»).
--
-- ORDEN OBLIGATORIO: correr ANTES `scripts/i366-verificar-copia-nueva.ts` — verifica que la
-- copia NUEVA (ContenidoReporte) descifra para las 5 filas. Sin ese verde esto es PÉRDIDA
-- DE DATOS, no limpieza. El CEO corre el psql; no se ejecuta por `migrate deploy` a ciegas.

-- Belt (la compuerta real es el pre-flight): abortar si hay texto viejo sin copia nueva.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Reporte"
    WHERE ("texto" IS NOT NULL OR "textoOriginal" IS NOT NULL) AND "contenidoId" IS NULL
  ) THEN
    RAISE EXCEPTION '[I-366] Fila con texto viejo y sin contenidoId — falta backfill. Abortado.';
  END IF;
END $$;

-- 1) Destruir las copias viejas (llave global). Explícito y auditable, separado del DROP.
UPDATE "Reporte" SET "texto" = NULL, "textoOriginal" = NULL
 WHERE "texto" IS NOT NULL OR "textoOriginal" IS NOT NULL;

-- 2) Quitar las TRES columnas congeladas (EventoExpediente.texto ya vacía en prod; se dropea igual).
ALTER TABLE "Reporte" DROP COLUMN IF EXISTS "texto";
ALTER TABLE "Reporte" DROP COLUMN IF EXISTS "textoOriginal";
ALTER TABLE "EventoExpediente" DROP COLUMN IF EXISTS "texto";
