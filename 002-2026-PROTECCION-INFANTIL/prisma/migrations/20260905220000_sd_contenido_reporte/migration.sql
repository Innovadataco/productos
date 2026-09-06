-- S-D (propuesta v4.1) · ContenidoReporte + LlaveReporte (texto cifrado, DEK POR DENUNCIA)
-- + FKs 1:1 + trigger simétrico. Corre en la VENTANA sobre la base YA VACÍA (borrón previo).
-- NO se mergea hasta la ventana (deploy-prod.sh aplica `migrate deploy` sin gate).

-- Guard (revisión #5, cinturón y tirantes con el gate c-ter): esta migración exige `Reporte`
-- y `EventoExpediente` VACÍOS, porque agrega `contenidoId` NOT NULL sin default. Falla RUIDOSO
-- y ANTES de tocar el esquema si no lo están (en vez del 23502 críptico).
DO $$
BEGIN
  IF (SELECT count(*) FROM "Reporte") > 0 OR (SELECT count(*) FROM "EventoExpediente") > 0 THEN
    RAISE EXCEPTION 'S-D: Reporte (%) o EventoExpediente (%) no están vacías. Corra reset-piloto --purga-total antes de migrar (v4.1 §7 c-ter).',
      (SELECT count(*) FROM "Reporte"), (SELECT count(*) FROM "EventoExpediente");
  END IF;
END $$;

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

-- FK 1:1 en Reporte (la FK vive acá: cierra la Trampa A). NOT NULL sobre tabla vacía.
ALTER TABLE "Reporte" ADD COLUMN "contenidoId" TEXT NOT NULL;
CREATE UNIQUE INDEX "Reporte_contenidoId_key" ON "Reporte"("contenidoId");
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "ContenidoReporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK 1:1 en EventoExpediente (su propio contenido; nunca comparte fila con el reporte).
ALTER TABLE "EventoExpediente" ADD COLUMN "contenidoId" TEXT NOT NULL;
CREATE UNIQUE INDEX "EventoExpediente_contenidoId_key" ON "EventoExpediente"("contenidoId");
ALTER TABLE "EventoExpediente" ADD CONSTRAINT "EventoExpediente_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "ContenidoReporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DROP del texto viejo (D-117): el relato vive SOLO en ContenidoReporte (con ADDITIVE el
-- cripto-shred sería falso — la copia vieja quedaría legible al lado). Seguro sobre tabla
-- vacía (guard arriba). NO toca bi_replica: `Reporte.texto`/`textoOriginal` están VETADAS
-- (columnas_vetadas, 02:240-241) y fuera de la lista publicada de 26 columnas (02:111);
-- `EventoExpediente` está en `tablas_prohibidas` (02:219). Verificado por el CEO en master.
ALTER TABLE "Reporte" DROP COLUMN "texto";
ALTER TABLE "Reporte" DROP COLUMN "textoOriginal";
ALTER TABLE "EventoExpediente" DROP COLUMN "texto";

-- Trigger SIMÉTRICO con guarda (revisión #12): borra el ContenidoReporte SOLO si ya no lo
-- referencia ni un Reporte ni un EventoExpediente. Cubre los 13 caminos de borrado + SQL crudo
-- por el MOTOR (no por parches de call-site). La FK Restrict hace tronar un borrado que dejaría
-- huérfano; la guarda `NOT EXISTS` evita que el trigger choque con esa Restrict. Al borrar el
-- ContenidoReporte, LlaveReporte cae por Cascade → la DEK se quema.
CREATE OR REPLACE FUNCTION "borrar_contenido_si_sin_referente"(cid TEXT) RETURNS void AS $$
    DELETE FROM "ContenidoReporte" c
     WHERE c.id = cid
       AND NOT EXISTS (SELECT 1 FROM "Reporte" r          WHERE r."contenidoId" = c.id)
       AND NOT EXISTS (SELECT 1 FROM "EventoExpediente" e WHERE e."contenidoId" = c.id);
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION "tg_borra_contenido_huerfano"() RETURNS TRIGGER AS $$
BEGIN
    PERFORM "borrar_contenido_si_sin_referente"(OLD."contenidoId");
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reporte_borra_contenido"
    AFTER DELETE ON "Reporte"
    FOR EACH ROW EXECUTE FUNCTION "tg_borra_contenido_huerfano"();

CREATE TRIGGER "evento_borra_contenido"
    AFTER DELETE ON "EventoExpediente"
    FOR EACH ROW EXECUTE FUNCTION "tg_borra_contenido_huerfano"();

-- Higiene BI (revisión #19): el rol de réplica NO lee la evidencia. Condicional: en el DB de CI
-- el rol `bi_replica` puede no existir (lo crea el 006), y un REVOKE a un rol inexistente aborta
-- la migración. NO cierra el hueco de pg_basebackup con atributo REPLICATION — eso es custodia
-- externa de la KEK (§8), no este REVOKE.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_replica') THEN
    REVOKE ALL ON "ContenidoReporte" FROM bi_replica;
    REVOKE ALL ON "LlaveReporte" FROM bi_replica;
  END IF;
END $$;
