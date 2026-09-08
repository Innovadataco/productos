-- SPEC-590 (06-09-2026): perfil del padre — email editable + historial de cambios.
-- Aditiva: nada se borra ni se reescribe.
-- 1) Vinculación Google: el sub del proveedor queda en la cuenta para que el
--    login OAuth (que resuelve por sub PRIMERO y por email después) no duplique
--    la cuenta cuando el padre cambie su email.
-- 2) Auditoría: nuevo valor de AccionAudit para los cambios de perfil.
ALTER TABLE "Usuario" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "Usuario_googleSub_key" ON "Usuario"("googleSub");
ALTER TYPE "AccionAudit" ADD VALUE 'PERFIL_CAMBIO';
