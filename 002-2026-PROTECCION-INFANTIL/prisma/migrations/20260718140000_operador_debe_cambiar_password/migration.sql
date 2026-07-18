-- Manual migration: flag debeCambiarPassword y nuevas acciones de audit para operadores

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_PASSWORD_REGENERADA';
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_EMAIL_REENVIADO';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false;
