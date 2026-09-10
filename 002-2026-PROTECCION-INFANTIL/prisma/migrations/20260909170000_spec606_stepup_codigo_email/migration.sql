-- SPEC-606 · step-up del texto sensible con código de 6 dígitos por correo.
-- 100 % aditiva: 3 valores nuevos de AccionAudit + tabla CodigoStepUp.
-- En reposo vive SOLO el sha-256 del código (nunca en claro); un solo código
-- vigente por usuario (la nueva solicitud expira los anteriores en la misma tx);
-- máx 5 intentos de verificación; un solo uso (consumidoEn).

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'STEP_UP_CODIGO_SOLICITADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'STEP_UP_CODIGO_VERIFICADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'STEP_UP_CODIGO_FALLIDO';

CREATE TABLE "CodigoStepUp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(6) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "consumidoEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoStepUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CodigoStepUp_usuarioId_idx" ON "CodigoStepUp"("usuarioId");

ALTER TABLE "CodigoStepUp" ADD CONSTRAINT "CodigoStepUp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
