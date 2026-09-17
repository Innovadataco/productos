-- SPEC-685 (PR2-bis): la tarifa por consulta se fija en «Mi perfil» tras la
-- habilitación. Antes no hay tarifa: la columna pasa a NULABLE (null = «por fijar»),
-- sin 0 centinela. Escrita a mano (I-420: `migrate dev` genera deriva destructiva).
-- Solo quita el NOT NULL; no toca datos existentes.
ALTER TABLE "PerfilProfesional" ALTER COLUMN "tarifaConsultaCOP" DROP NOT NULL;
