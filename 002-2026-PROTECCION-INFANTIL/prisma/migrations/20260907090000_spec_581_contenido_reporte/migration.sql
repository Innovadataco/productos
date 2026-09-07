-- SPEC-581 · ContenidoReporte + LlaveReporte (texto cifrado, DEK POR DENUNCIA) — VERSIÓN ADITIVA.
-- Reemplaza a la propuesta destructiva de S-D (20260905220000): esta migración NO DROPea
-- nada. Las columnas viejas `Reporte.texto`, `Reporte.textoOriginal` y `EventoExpediente.texto`
-- quedan INTACTAS en la base (Prisma las ignora porque ya no están en el modelo); el texto
-- nuevo se escribe SOLO en ContenidoReporte y las viejas quedan congeladas (fin de escrituras
-- por el código, que ya no las referencia).
--
-- `contenidoId` se agrega NULLABLE (no hay default posible sobre tabla con datos). El
-- script `scripts/backfill-contenido-reporte.ts` migra las filas existentes (descifra el
-- `enc:` viejo con PARAM_ENCRYPTION_KEY y re-cifra con la capa DEK). El apriete a
-- NOT NULL se hace en una migración aparte, DESPUÉS del backfill (cuando ya no hay NULLs).

-- Origen de la evidencia legal del contenido.
CREATE TYPE "OrigenEvidencia" AS ENUM ('ORIGINAL', 'PURGADA');

-- Contenido cifrado del relato. NUNCA se publica a bi_replica (tablas_prohibidas + REVOKE abajo).
-- La versión de la KEK NO vive acá: vive en LlaveReporte.kekVersion (v4.1 §1.3).
CREATE TABLE "ContenidoReporte" (
    "id" TEXT NOT NULL,
    "textoCifrado" TEXT NOT NULL,
    "textoOriginalCifrado" TEXT NOT NULL,
    "origenEvidencia" "OrigenEvidencia" NOT NULL,
    "purgadoEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ContenidoReporte_pkey" PRIMARY KEY ("id")
);

-- Llavero: la DEK por denuncia, ENVUELTA por la KEK. SIN nombres ni PII.
CREATE TABLE "LlaveReporte" (
    "id" TEXT NOT NULL,
    "contenidoId" TEXT NOT NULL,
    "dekCifrada" TEXT NOT NULL,
    "kekVersion" INTEGER NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LlaveReporte_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LlaveReporte_contenidoId_key" ON "LlaveReporte"("contenidoId");
-- Quemar el contenido quema su DEK (cripto-shred de ese caso).
ALTER TABLE "LlaveReporte" ADD CONSTRAINT "LlaveReporte_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "ContenidoReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK 1:1 en Reporte (la FK vive acá: cierra la Trampa A). NULLABLE en esta fase aditiva;
-- el NOT NULL llega en migración follow-up tras el backfill (ver encabezado).
ALTER TABLE "Reporte" ADD COLUMN "contenidoId" TEXT;
CREATE UNIQUE INDEX "Reporte_contenidoId_key" ON "Reporte"("contenidoId");
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "ContenidoReporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Relajación de constraint (NO destructiva — no toca datos): Prisma ya no conoce las columnas
-- viejas, así que ningún INSERT las provee; el NOT NULL viejo tumbaría TODO alta nueva con
-- 23502. El texto viejo queda congelado en su columna y la evidencia vive en ContenidoReporte.
ALTER TABLE "Reporte" ALTER COLUMN "texto" DROP NOT NULL;
ALTER TABLE "EventoExpediente" ALTER COLUMN "texto" DROP NOT NULL;

-- FK 1:1 en EventoExpediente (su propio contenido; nunca comparte fila con el reporte).
ALTER TABLE "EventoExpediente" ADD COLUMN "contenidoId" TEXT;
CREATE UNIQUE INDEX "EventoExpediente_contenidoId_key" ON "EventoExpediente"("contenidoId");
ALTER TABLE "EventoExpediente" ADD CONSTRAINT "EventoExpediente_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "ContenidoReporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger SIMÉTRICO con guarda: borra el ContenidoReporte SOLO si ya no lo referencia ni un
-- Reporte ni un EventoExpediente. Cubre los caminos de borrado + SQL crudo por el MOTOR.
-- La FK Restrict hace tronar un borrado que dejaría huérfano; la guarda NOT EXISTS evita que
-- el trigger choque con esa Restrict. NULL-guard: las filas legadas sin contenidoId (previas
-- al backfill) no disparan barrido. Al borrar el ContenidoReporte, LlaveReporte cae por
-- Cascade → la DEK se quema.
CREATE OR REPLACE FUNCTION "borrar_contenido_si_sin_referente"(cid TEXT) RETURNS void AS $$
    DELETE FROM "ContenidoReporte" c
     WHERE c.id = cid
       AND NOT EXISTS (SELECT 1 FROM "Reporte" r          WHERE r."contenidoId" = c.id)
       AND NOT EXISTS (SELECT 1 FROM "EventoExpediente" e WHERE e."contenidoId" = c.id);
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION "tg_borra_contenido_huerfano"() RETURNS TRIGGER AS $$
BEGIN
    IF OLD."contenidoId" IS NOT NULL THEN
        PERFORM "borrar_contenido_si_sin_referente"(OLD."contenidoId");
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reporte_borra_contenido"
    AFTER DELETE ON "Reporte"
    FOR EACH ROW EXECUTE FUNCTION "tg_borra_contenido_huerfano"();

CREATE TRIGGER "evento_borra_contenido"
    AFTER DELETE ON "EventoExpediente"
    FOR EACH ROW EXECUTE FUNCTION "tg_borra_contenido_huerfano"();

-- XOR de dueño (CEO 06-09 · RISK 2): un ContenidoReporte pertenece a EXACTAMENTE un dueño. El
-- `@unique` de cada FK ya impide DOS del MISMO tipo; esto cierra el cruce que Prisma no expresa
-- (un Reporte Y un EventoExpediente compartiendo la misma fila cifrada). NULL-guard: filas
-- legadas sin contenidoId no se evalúan (NULL no comparte nada). Guarda en el MOTOR.
CREATE OR REPLACE FUNCTION "tg_contenido_un_solo_dueno"() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."contenidoId" IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'Reporte' THEN
        IF EXISTS (SELECT 1 FROM "EventoExpediente" e WHERE e."contenidoId" = NEW."contenidoId") THEN
            RAISE EXCEPTION 'XOR de dueño: ContenidoReporte % ya pertenece a un EventoExpediente; un Reporte no puede compartirlo.', NEW."contenidoId";
        END IF;
    ELSE
        IF EXISTS (SELECT 1 FROM "Reporte" r WHERE r."contenidoId" = NEW."contenidoId") THEN
            RAISE EXCEPTION 'XOR de dueño: ContenidoReporte % ya pertenece a un Reporte; un EventoExpediente no puede compartirlo.', NEW."contenidoId";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reporte_un_solo_dueno"
    BEFORE INSERT OR UPDATE OF "contenidoId" ON "Reporte"
    FOR EACH ROW EXECUTE FUNCTION "tg_contenido_un_solo_dueno"();

CREATE TRIGGER "evento_un_solo_dueno"
    BEFORE INSERT OR UPDATE OF "contenidoId" ON "EventoExpediente"
    FOR EACH ROW EXECUTE FUNCTION "tg_contenido_un_solo_dueno"();

-- Higiene BI: el rol de réplica NO lee la evidencia. Condicional: en el DB de CI
-- el rol `bi_replica` puede no existir, y un REVOKE a un rol inexistente aborta la migración.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_replica') THEN
    REVOKE ALL ON "ContenidoReporte" FROM bi_replica;
    REVOKE ALL ON "LlaveReporte" FROM bi_replica;
  END IF;
END $$;
