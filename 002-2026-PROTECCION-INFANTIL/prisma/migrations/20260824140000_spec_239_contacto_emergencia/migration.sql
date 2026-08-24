-- SPEC-239 (002-PI-mega-cola): escalación ROJO + SLA 12h + contactos de emergencia.
-- Migración aditiva: nuevo enum, nueva tabla contactos_emergencia, columnas
-- nuevas en "Expediente" (sla_efectivo equivalente Prisma: slaEfectivoHoras),
-- índices y valores nuevos de AccionAudit. Cero DROP, cero pérdida de datos.

-- Enum nuevo: relación del contacto de emergencia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RelacionContactoEmergencia') THEN
    CREATE TYPE "RelacionContactoEmergencia" AS ENUM ('MADRE', 'PADRE', 'TUTOR', 'HERMANO', 'OTRO');
  END IF;
END $$;

-- Tabla nueva: contactos de emergencia del padre.
CREATE TABLE IF NOT EXISTS "contactos_emergencia" (
  "id"              TEXT NOT NULL,
  "padreUsuarioId"  TEXT NOT NULL,
  "nombre"          TEXT NOT NULL,
  "relacion"        "RelacionContactoEmergencia" NOT NULL,
  "telefono"        TEXT NOT NULL,
  "email"           TEXT,
  "prioridad"       INTEGER NOT NULL,
  "activo"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "contactos_emergencia_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contactos_emergencia_padreUsuarioId_fkey'
  ) THEN
    ALTER TABLE "contactos_emergencia"
      ADD CONSTRAINT "contactos_emergencia_padreUsuarioId_fkey"
      FOREIGN KEY ("padreUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "contactos_emergencia_padreUsuarioId_prioridad_idx"
  ON "contactos_emergencia"("padreUsuarioId", "prioridad");

-- Campos aditivos del expediente: SLA efectivo y marca de escalamiento a ROJO.
ALTER TABLE "Expediente" ADD COLUMN IF NOT EXISTS "slaEfectivoHoras" INTEGER;
ALTER TABLE "Expediente" ADD COLUMN IF NOT EXISTS "fechaEscaladoRojoEn" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "Expediente_scoreGravedadActual_estado_fechaEscaladoRojoEn_idx"
  ON "Expediente"("scoreGravedadActual", "estado", "fechaEscaladoRojoEn");

-- Valores nuevos de AccionAudit (patrón idempotente del repo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'CONTACTO_EMERGENCIA_CREADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'CONTACTO_EMERGENCIA_CREADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'CONTACTO_EMERGENCIA_ACTUALIZADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'CONTACTO_EMERGENCIA_ACTUALIZADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'CONTACTO_EMERGENCIA_ELIMINADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'CONTACTO_EMERGENCIA_ELIMINADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'CONTACTO_EMERGENCIA_FALLBACK_USADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'CONTACTO_EMERGENCIA_FALLBACK_USADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'EXPEDIENTE_ESCALADO_A_ROJO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'EXPEDIENTE_ESCALADO_A_ROJO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'EXPEDIENTE_EMERGENCIA_ACTIVADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'EXPEDIENTE_EMERGENCIA_ACTIVADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'EXPEDIENTE_COMITE_SLA_VENCIDO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'EXPEDIENTE_COMITE_SLA_VENCIDO';
  END IF;
END $$;
