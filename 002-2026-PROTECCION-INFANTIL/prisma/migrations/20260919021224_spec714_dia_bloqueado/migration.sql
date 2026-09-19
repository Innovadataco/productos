-- SPEC-714 (decision CEO 18-09) · Dia que el profesional CIERRA en su agenda.
--
-- Modelo nuevo DiaBloqueado: profesionalId + fecha (dia calendario Bogota
-- `yyyy-MM-dd` como TEXTO, no @db.Date — un @db.Date se lee a medianoche UTC y,
-- proyectado a Bogota, se corre un dia; el dia es una etiqueta, no un instante) +
-- motivo opcional + creadoEn. Unico (profesionalId, fecha): un dia se bloquea una
-- sola vez (idempotente). FK a PerfilProfesional ON DELETE CASCADE: un dia cerrado
-- no tiene sentido sin su profesional y no debe trabar una purga (franjas/citas
-- son Restrict a proposito, esto es estado operativo liviano).
--
-- Migracion A MANO (I-420): tabla NUEVA, no toca ninguna tabla ni indice
-- existente; SQL generado con `prisma migrate diff` (datamodel->datamodel, sin
-- shadow DB) para que case exacto con el schema. No toca datos. (D-121 Datos.)

-- CreateTable
CREATE TABLE "DiaBloqueado" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaBloqueado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaBloqueado_profesionalId_fecha_key" ON "DiaBloqueado"("profesionalId", "fecha");

-- AddForeignKey
ALTER TABLE "DiaBloqueado" ADD CONSTRAINT "DiaBloqueado_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
