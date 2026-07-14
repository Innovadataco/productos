-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "accion" "AccionAudit" NOT NULL,
    "tipoRecurso" TEXT NOT NULL,
    "recursoId" TEXT,
    "usuarioId" TEXT,
    "parametroId" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "metadatos" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_parametroId_idx" ON "AuditLog"("parametroId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_accion_idx" ON "AuditLog"("accion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_creadoEn_idx" ON "AuditLog"("creadoEn");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AuditLog_usuarioId_fkey' AND table_name = 'AuditLog'
    ) THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey"
        FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AuditLog_parametroId_fkey' AND table_name = 'AuditLog'
    ) THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_parametroId_fkey"
        FOREIGN KEY ("parametroId") REFERENCES "ParametroSistema"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;
