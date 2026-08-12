-- SPEC-168: hash determinístico para detectar documentos duplicados de integrantes
-- sin exponer el número de identificación. El default genera un placeholder único
-- por fila para migraciones existentes; la aplicación sobrescribe con el hash real
-- al crear o actualizar integrantes.
ALTER TABLE "IntegranteComite" ADD COLUMN "hashIdentificacion" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX "IntegranteComite_comiteId_hashIdentificacion_key" ON "IntegranteComite"("comiteId", "hashIdentificacion");
