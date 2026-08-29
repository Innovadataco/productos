-- SPEC-132 (S-4): tabla de sesiones de carga masiva (roster server-side con TTL).
-- ADITIVA: tabla nueva, nada destructivo.
CREATE TABLE "CargaRosterSesion" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "filas" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargaRosterSesion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CargaRosterSesion_expiraEn_idx" ON "CargaRosterSesion"("expiraEn");
