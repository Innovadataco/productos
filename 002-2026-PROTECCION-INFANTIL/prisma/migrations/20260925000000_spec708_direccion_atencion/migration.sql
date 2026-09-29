-- SPEC-708: dirección FIJA del consultorio para la cita PRESENCIAL. NULABLE.
-- H-2 (Ley 2375/2024): dato de CONTACTO — nunca sale al DTO público; la familia la ve
-- solo con la cita CONFIRMADA (SPEC-715). Escrita a MANO (I-420: `migrate dev` genera
-- deriva destructiva). Solo AGREGA una columna nulable; no toca datos existentes.
-- (El enlace de videollamada NO va acá: lo crea el operador por-cita, en SolicitudCita.)
ALTER TABLE "PerfilProfesional" ADD COLUMN "direccionAtencion" TEXT;
