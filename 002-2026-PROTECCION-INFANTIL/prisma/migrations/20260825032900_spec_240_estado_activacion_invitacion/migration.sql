-- SPEC-240 (002-PI-143): estado de activación institucional y token de invitación.
-- Migración 100% aditiva: CREATE TYPE + ALTER TABLE ADD COLUMN + índice único. Cero DROP.

CREATE TYPE "EstadoActivacion" AS ENUM ('REGISTRADO', 'INVITADO', 'ACTIVO');

ALTER TABLE "Usuario" ADD COLUMN "estadoActivacion" "EstadoActivacion" NOT NULL DEFAULT 'REGISTRADO';
ALTER TABLE "Usuario" ADD COLUMN "tokenInvitacion" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "tokenInvitacionExpiraEn" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "Usuario_tokenInvitacion_key" ON "Usuario"("tokenInvitacion");
