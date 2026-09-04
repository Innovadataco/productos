-- SPEC-429 (A-75 · brief v2.2 §7 L6-bis + §9-bis · orden CEO 23:5x)
-- Las dos encuestas y el cruce. Modelo nuevo, sin estrellas ni texto libre.
--
-- 1) Se retira `EncuestaPrimeraCita` (SPEC-388a: huérfana, 0 filas, 0 llamadores).
-- 2) Se crea `EncuestaCita` (una por lado, 5 respuestas de opción).
-- 3) Se crea `IncidenteContradiccionEncuesta` (cruce r1/r2 al cerrar la 2ª).
-- 4) Se agrega `Usuario.encuestaPendiente` (guardia estilo `debeCambiarPassword`).

BEGIN;

-- 1) Drop EncuestaPrimeraCita (contradice §9-bis; sin filas ni callers).
DROP TABLE IF EXISTS "EncuestaPrimeraCita";

-- 2) Enum + tabla EncuestaCita.
DO $$ BEGIN
    CREATE TYPE "OrigenEncuestaCita" AS ENUM ('PADRE', 'PROFESIONAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "EncuestaCita" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "origen" "OrigenEncuestaCita" NOT NULL,
    "r1" TEXT NOT NULL,
    "r2" TEXT NOT NULL,
    "r3" TEXT NOT NULL,
    "r4" TEXT NOT NULL,
    "r5" TEXT NOT NULL,
    "respondidaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EncuestaCita_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EncuestaCita_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Una encuesta por (solicitud, origen) — el 2º intento del mismo lado
-- debe caer con 409, no duplicar la fila.
CREATE UNIQUE INDEX "EncuestaCita_solicitudId_origen_key"
    ON "EncuestaCita"("solicitudId", "origen");

CREATE INDEX "EncuestaCita_origen_respondidaEn_idx"
    ON "EncuestaCita"("origen", "respondidaEn");

-- 3) Tabla IncidenteContradiccionEncuesta.
CREATE TABLE "IncidenteContradiccionEncuesta" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "pregunta" TEXT NOT NULL,
    "padreValor" TEXT NOT NULL,
    "profesionalValor" TEXT NOT NULL,
    "detectadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPor" TEXT,
    CONSTRAINT "IncidenteContradiccionEncuesta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IncidenteContradiccionEncuesta_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IncidenteContradiccionEncuesta_solicitudId_pregunta_key"
    ON "IncidenteContradiccionEncuesta"("solicitudId", "pregunta");

CREATE INDEX "IncidenteContradiccionEncuesta_resueltoEn_detectadoEn_idx"
    ON "IncidenteContradiccionEncuesta"("resueltoEn", "detectadoEn");

-- 4) Guardia `Usuario.encuestaPendiente` (estilo `debeCambiarPassword`).
ALTER TABLE "Usuario"
    ADD COLUMN IF NOT EXISTS "encuestaPendiente" BOOLEAN NOT NULL DEFAULT false;

COMMIT;

-- 5) Acciones de auditoría específicas. ALTER TYPE ADD VALUE NO puede correr
-- dentro de un bloque `BEGIN`/`COMMIT` cuando el enum ya existe en otra
-- transacción previa (Postgres): se ejecuta fuera. `IF NOT EXISTS` por valor
-- garantiza idempotencia (lección I-277).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ENCUESTA_CITA_CONTRADICCION';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ENCUESTA_CITA_RESPONDIDA';
