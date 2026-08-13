-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ONBOARDING_OMITIDO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ONBOARDING_REACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ONBOARDING_COMPLETADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_NOTIFICACION_CREADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_NOTIFICACION_LEIDA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_NOTIFICACION_ARCHIVADA';

-- DropForeignKey
ALTER TABLE "AlertaColegio" DROP CONSTRAINT "AlertaColegio_identificadorAlumnoId_fkey";

-- DropIndex

-- DropIndex

-- DropIndex

-- DropIndex

-- AlterTable
ALTER TABLE "IntegranteComite" ALTER COLUMN "hashIdentificacion" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OnboardingColegio" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "pasoActual" INTEGER NOT NULL DEFAULT 1,
    "completadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingColegio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionInApp" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "entidadId" TEXT,
    "leidaEn" TIMESTAMP(3),
    "archivadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacionInApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingColegio_colegioId_key" ON "OnboardingColegio"("colegioId");

-- CreateIndex
CREATE INDEX "OnboardingColegio_estado_idx" ON "OnboardingColegio"("estado");

-- CreateIndex
CREATE INDEX "NotificacionInApp_colegioId_usuarioId_archivadaEn_leidaEn_c_idx" ON "NotificacionInApp"("colegioId", "usuarioId", "archivadaEn", "leidaEn", "creadoEn");

-- CreateIndex
CREATE INDEX "NotificacionInApp_colegioId_usuarioId_archivadaEn_creadoEn_idx" ON "NotificacionInApp"("colegioId", "usuarioId", "archivadaEn", "creadoEn");

-- CreateIndex
CREATE INDEX "NotificacionInApp_colegioId_entidadId_tipo_idx" ON "NotificacionInApp"("colegioId", "entidadId", "tipo");

-- Backfill SPEC-169: crear una fila de OnboardingColegio por cada colegio existente.
-- Estado 'completado' si ya tiene al menos un identificador activo; 'activo' en otro caso.
INSERT INTO "OnboardingColegio" ("id", "colegioId", "estado", "pasoActual", "completadoEn", "creadoEn", "actualizadoEn")
SELECT
    gen_random_uuid()::text,
    c.id,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "IdentificadorAlumno" ia
            JOIN "Alumno" a ON a.id = ia."alumnoId"
            WHERE a."colegioId" = c.id AND ia.estado = 'activo'
        )
        OR EXISTS (
            SELECT 1 FROM "IdentificadorProfesor" ip
            WHERE ip."colegioId" = c.id AND ip.estado = 'activo'
        )
        OR EXISTS (
            SELECT 1 FROM "IdentificadorAcudiente" iac
            WHERE iac."colegioId" = c.id AND iac.estado = 'activo'
        )
        THEN 'completado'
        ELSE 'activo'
    END,
    1,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "IdentificadorAlumno" ia
            JOIN "Alumno" a ON a.id = ia."alumnoId"
            WHERE a."colegioId" = c.id AND ia.estado = 'activo'
        )
        OR EXISTS (
            SELECT 1 FROM "IdentificadorProfesor" ip
            WHERE ip."colegioId" = c.id AND ip.estado = 'activo'
        )
        OR EXISTS (
            SELECT 1 FROM "IdentificadorAcudiente" iac
            WHERE iac."colegioId" = c.id AND iac.estado = 'activo'
        )
        THEN NOW()
        ELSE NULL
    END,
    NOW(),
    NOW()
FROM "Colegio" c
LEFT JOIN "OnboardingColegio" oc ON oc."colegioId" = c.id
WHERE oc.id IS NULL;

-- AddForeignKey
ALTER TABLE "OnboardingColegio" ADD CONSTRAINT "OnboardingColegio_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionInApp" ADD CONSTRAINT "NotificacionInApp_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionInApp" ADD CONSTRAINT "NotificacionInApp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorAlumnoId_fkey" FOREIGN KEY ("identificadorAlumnoId") REFERENCES "IdentificadorAlumno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "patrones_institucionales_colegioId_periodo_grado_conducta__key" RENAME TO "patrones_institucionales_colegioId_periodo_grado_conducta_p_key";
