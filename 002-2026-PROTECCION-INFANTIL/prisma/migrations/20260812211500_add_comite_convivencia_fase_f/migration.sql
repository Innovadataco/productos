-- SPEC-168: Comité de Convivencia por colegio (Fase F).
-- Migración aditiva: añade rol, campos, relaciones e índices.

-- Acciones de auditoría del módulo
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_PASSWORD_REGENERADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_INTEGRANTE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_INTEGRANTE_INACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CASO_ESCALADO_A_COMITE';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CASO_RESUELTO_POR_COMITE';

-- Nuevo rol
ALTER TYPE "RolUsuario" ADD VALUE 'COMITE_CONVIVENCIA';

-- Cargo del integrante del comité
ALTER TABLE "IntegranteComite" ADD COLUMN "cargo" TEXT;

-- Escalamiento colegio-scoped al Comité de Convivencia
ALTER TABLE "SolicitudComite" ADD COLUMN "alertaColegioId" TEXT,
                               ADD COLUMN "colegioId" TEXT,
                               ADD COLUMN "creadoPorId" TEXT;

-- Cuenta compartida del comité (una por colegio)
ALTER TABLE "Usuario" ADD COLUMN "comiteColegioId" TEXT;

-- Índices y unicidades
CREATE UNIQUE INDEX "SolicitudComite_alertaColegioId_key" ON "SolicitudComite"("alertaColegioId");
CREATE INDEX "SolicitudComite_colegioId_idx" ON "SolicitudComite"("colegioId");
CREATE INDEX "SolicitudComite_alertaColegioId_idx" ON "SolicitudComite"("alertaColegioId");
CREATE INDEX "SolicitudComite_creadoPorId_idx" ON "SolicitudComite"("creadoPorId");
CREATE UNIQUE INDEX "Usuario_comiteColegioId_key" ON "Usuario"("comiteColegioId");

-- Relaciones
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_comiteColegioId_fkey"
    FOREIGN KEY ("comiteColegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_colegioId_fkey"
    FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_alertaColegioId_fkey"
    FOREIGN KEY ("alertaColegioId") REFERENCES "AlertaColegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
