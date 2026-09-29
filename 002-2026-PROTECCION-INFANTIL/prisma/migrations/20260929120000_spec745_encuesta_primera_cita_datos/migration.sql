-- SPEC-745 · capa de DATOS de la encuesta de primera cita (dictamen D-121 de Datos).
-- Migración ADITIVA: agrega una restricción y cambia la acción de una FK; no borra datos.

-- (1) CHECK real en Postgres: el puntaje es 1..5. Prisma es ciego al CHECK (no lo declara
--     en el modelo ni lo borra en un `migrate dev` futuro), así que esta restricción vive
--     solo en la BD y la prueba el candado de inserción real (0 y 6 -> 23514; 1 y 5 pasan).
ALTER TABLE "EncuestaPrimeraCita"
  ADD CONSTRAINT "EncuestaPrimeraCita_puntaje_check" CHECK ("puntaje" BETWEEN 1 AND 5);

-- (2) onDelete: Cascade en la FK a SolicitudCita. Antes, sin declaración, la FK quedaba en
--     RESTRICT: dar de baja una cita con encuesta trababa con 23503 y el usuario recibía el
--     error crudo de la base. La encuesta es un satélite 1:1 de la cita: se va con ella.
ALTER TABLE "EncuestaPrimeraCita" DROP CONSTRAINT "EncuestaPrimeraCita_solicitudId_fkey";
ALTER TABLE "EncuestaPrimeraCita" ADD CONSTRAINT "EncuestaPrimeraCita_solicitudId_fkey"
  FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
