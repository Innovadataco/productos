-- CreateTable
CREATE TABLE IF NOT EXISTS "TokenRecuperacion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TokenRecuperacion_email_idx" ON "TokenRecuperacion"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TokenRecuperacion_tokenHash_idx" ON "TokenRecuperacion"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TokenRecuperacion_expiraEn_idx" ON "TokenRecuperacion"("expiraEn");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TokenRecuperacion_usuarioId_fkey' AND table_name = 'TokenRecuperacion'
    ) THEN
        ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey"
        FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;
