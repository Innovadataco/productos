-- SPEC-350 (A-69 · C3) · el análisis IA del caso del colegio comparte la
-- tabla AnalisisExpediente. ADITIVA: columna nueva nullable + expedienteId
-- pasa a nullable + CHECK XOR (cinturón del CEO: exactamente uno de los dos
-- dueños) + índices espejo de los del expediente.

-- 1. expedienteId pasa a nullable (los análisis del caso no lo llevan).
ALTER TABLE "AnalisisExpediente" ALTER COLUMN "expedienteId" DROP NOT NULL;

-- 2. Columna del dueño colegio.
ALTER TABLE "AnalisisExpediente" ADD COLUMN "seguimientoCasoId" TEXT;

ALTER TABLE "AnalisisExpediente"
    ADD CONSTRAINT "AnalisisExpediente_seguimientoCasoId_fkey"
    FOREIGN KEY ("seguimientoCasoId") REFERENCES "SeguimientoCaso"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. CHECK XOR: exactamente uno de los dos dueños. Todas las filas actuales
--    tienen expedienteId (venían del padre), así que el check pasa.
ALTER TABLE "AnalisisExpediente"
    ADD CONSTRAINT "AnalisisExpediente_dueno_xor_check"
    CHECK (("expedienteId" IS NOT NULL)::int + ("seguimientoCasoId" IS NOT NULL)::int = 1);

-- 4. Unicidad e índices del lado caso (espejo del lado expediente).
CREATE UNIQUE INDEX "AnalisisExpediente_seguimientoCasoId_versionSecuencial_key"
    ON "AnalisisExpediente"("seguimientoCasoId", "versionSecuencial");
CREATE INDEX "AnalisisExpediente_seguimientoCasoId_estado_idx"
    ON "AnalisisExpediente"("seguimientoCasoId", "estado");
CREATE INDEX "AnalisisExpediente_seguimientoCasoId_hashCadena_estado_idx"
    ON "AnalisisExpediente"("seguimientoCasoId", "hashCadena", "estado");
