-- SPEC-427 (A-75 · L6 · brief §9 momento 6) — los dos códigos del cierre.
-- Aditiva: una tabla nueva, un enum nuevo y una columna nullable. Nada que
-- reescriba filas existentes, así que no necesita ventana de mantenimiento.

CREATE TYPE "TipoCodigoCita" AS ENUM ('CITA', 'EXPEDIENTE');

CREATE TABLE "CodigoCita" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "tipo" "TipoCodigoCita" NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMPTZ(6) NOT NULL,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMPTZ(6),
    "notificacionId" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoCita_pkey" PRIMARY KEY ("id")
);

-- La traza y la validación piden lo mismo: el último código de un tipo.
CREATE INDEX "CodigoCita_solicitudId_tipo_creadoEn_idx"
    ON "CodigoCita"("solicitudId", "tipo", "creadoEn" DESC);

ALTER TABLE "CodigoCita" ADD CONSTRAINT "CodigoCita_solicitudId_fkey"
    FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- I-300 · el autocierre a 5 días deja MARCA PROPIA. `SIN_CONFIRMAR` cargaba dos
-- intenciones ("recién creada, nadie pagó" y "la cita pasó y nadie la cerró") y
-- la cola 2 del Verificador mostraba como incidente cualquier solicitud impaga.
-- La separación va en columna, no en inferencia (regla de SPEC-398 / I-278).
ALTER TABLE "SolicitudCita" ADD COLUMN "autocerradaEn" TIMESTAMPTZ(6);

-- Acciones de auditoría del cierre. Lección I-277: el valor de enum y el código
-- que lo emite viajan en la MISMA migración, nunca en dos PRs distintos.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_EMITIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_FALLIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CUMPLIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_AUTOCERRADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_NO_ASISTIO_PADRE';
