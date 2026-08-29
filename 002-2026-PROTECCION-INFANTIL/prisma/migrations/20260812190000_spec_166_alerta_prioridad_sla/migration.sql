-- SPEC-166: extender AlertaColegio con prioridad, vencimiento SLA y asignación.
-- Migración aditiva: solo columnas/índices/FK nuevos; no se tocan Curso, Estudiante ni sus relaciones.

-- 1. Estados extendidos: el comentario de Prisma refleja los valores; la columna String ya los soporta.
-- 2. Prioridad con default seguro para alertas históricas.
ALTER TABLE "AlertaColegio" ADD COLUMN "prioridad" TEXT NOT NULL DEFAULT 'media';

-- 3. Vencimiento SLA: temporalmente nullable para backfill, luego NOT NULL.
ALTER TABLE "AlertaColegio" ADD COLUMN "vencimientoSla" TIMESTAMP(3);
UPDATE "AlertaColegio" SET "vencimientoSla" = "creadoEn" + INTERVAL '48 hours' WHERE "vencimientoSla" IS NULL;
ALTER TABLE "AlertaColegio" ALTER COLUMN "vencimientoSla" SET NOT NULL;

-- 4. Asignación opcional a un usuario del colegio/plataforma.
ALTER TABLE "AlertaColegio" ADD COLUMN "asignadoAId" TEXT;

-- 5. Índices para la bandeja de prioridad y filtrado por asignado.
CREATE INDEX "AlertaColegio_colegioId_prioridad_vencimientoSla_idx" ON "AlertaColegio"("colegioId", "prioridad", "vencimientoSla");
CREATE INDEX "AlertaColegio_colegioId_asignadoAId_idx" ON "AlertaColegio"("colegioId", "asignadoAId");

-- 6. Foreign key a Usuario (asignación).
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
