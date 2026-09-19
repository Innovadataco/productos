-- SPEC-708: dónde/cómo atiende — dirección del presencial y enlace del virtual.
-- v1: dirección FIJA del consultorio + enlace FIJO de videollamada; ambos NULABLES.
-- H-2 (Ley 2375/2024): son dato de CONTACTO — nunca salen al DTO público; la familia
-- los ve solo con la cita CONFIRMADA (SPEC-715). Escrita a MANO (I-420: `migrate dev`
-- genera deriva destructiva). Solo AGREGA dos columnas nulables; no toca datos existentes.
ALTER TABLE "PerfilProfesional" ADD COLUMN "direccionAtencion" TEXT;
ALTER TABLE "PerfilProfesional" ADD COLUMN "enlaceVideollamada" TEXT;
