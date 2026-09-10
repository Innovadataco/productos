-- I-366 · Cripto-shred COMPLETO: purgar las copias de texto bajo la llave global vieja.
--
-- SPEC-581 fue ADITIVA (correcta — un DROP con filas aborta/pierde datos, D-125): dejó
-- `Reporte.texto`, `Reporte.textoOriginal` y `EventoExpediente.texto` INTACTAS en la BD
-- (Prisma ya no las mapea) tras backfillear el relato a `ContenidoReporte` (DEK por fila).
-- Consecuencia: las filas pre-backfill tienen DOS copias y quemar la DEK NO destruye la vieja
-- (shred parcial e invisible). Jelkin (2026-09-10) decidió borrarlas — esta migración es el
-- paso final que la 581 planeó («drop DESPUÉS del backfill»).
--
-- ORDEN OBLIGATORIO (corregido): `deploy-prod.sh` corre `prisma migrate deploy` en cada deploy,
-- así que ESTA migración se aplica SOLA en el deploy que sigue al merge — NO a mano por psql.
-- Por eso el pre-flight es un GATE PRE-MERGE: `scripts/i366-verificar-copia-nueva.ts` verde en
-- las 5 filas CONTRA PRODUCCIÓN *antes* de mergear (el merge dispara el deploy que aplica esto).
-- Sin ese verde esto es PÉRDIDA DE DATOS, no limpieza. NO MERGEAR hasta el pre-flight en verde.
-- El `belt` de abajo solo prueba que la fila EXISTA (contenidoId), no que DESCIFRE ni que COINCIDA
-- con la copia vieja — eso lo hace el pre-flight, que exige IGUALDAD vieja<->nueva por fila y por
-- campo (una sola discrepancia = NO PURGAR). Verificar «legible» no basta: una fila mal enlazada por
-- el backfill descifra legible pero incorrecta, y el DROP borraría la única copia correcta.

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

-- 2) Quitar las TRES columnas congeladas.
-- SALVEDAD (revisión adversarial de Dev 1, 2026-09-10): `EventoExpediente.texto` NO tiene red — ni el
-- belt de arriba ni el pre-flight la miran (ambos son de `Reporte`). Su DROP es seguro por SUPOSICIÓN,
-- no por guarda: desmapeada de Prisma + 0 filas en prod + 0 escritores, los TRES verificados hoy. Queda
-- escrito para saberlo, no para tener suerte: si en el futuro esta columna vuelve a poblarse, este DROP
-- perdería datos sin avisar. (Reporte.texto/textoOriginal sí están cubiertas por el pre-flight de igualdad.)
ALTER TABLE "Reporte" DROP COLUMN IF EXISTS "texto";
ALTER TABLE "Reporte" DROP COLUMN IF EXISTS "textoOriginal";
ALTER TABLE "EventoExpediente" DROP COLUMN IF EXISTS "texto";
