-- SPEC-758 (D-121) · esquema del ENLACE de la reunión POR CITA en SolicitudCita.
--
-- ADITIVA y nulable, SIN backfill: las citas existentes (297 en prod) quedan con
-- enlace NULL. Escrita a MANO a propósito (no `prisma migrate dev`, que genera
-- deriva destructiva — I-420). SQL verificado contra el schema con `prisma migrate
-- diff` datamodel↔datamodel (sin BD): es byte-equivalente a lo que Prisma generaría.
--
-- SOLO ESQUEMA — sin consumidor: la pantalla del operador, la validación de la URL
-- (solo https, server-side), el mostrar/ocultar derivado del tiempo y la asignación
-- van en SPEC-750. Acá NO se persiste caducidad ni vida del enlace (brief A-79 §7.6:
-- no las controlamos; la sala vive en un proveedor de video ajeno).

-- AlterTable
ALTER TABLE "SolicitudCita" ADD COLUMN     "enlaceOperadorId" TEXT,
ADD COLUMN     "enlacePublicadoEn" TIMESTAMPTZ(6),
ADD COLUMN     "enlaceReunion" TEXT;

-- AddForeignKey
-- Operador (Usuario) que tomó/creó el enlace. Opcional → ON DELETE SET NULL: dar de
-- baja la cuenta del operador suelta la referencia, no borra la cita.
ALTER TABLE "SolicitudCita" ADD CONSTRAINT "SolicitudCita_enlaceOperadorId_fkey" FOREIGN KEY ("enlaceOperadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
