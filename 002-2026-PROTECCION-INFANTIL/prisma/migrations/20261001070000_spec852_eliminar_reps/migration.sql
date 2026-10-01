-- SPEC-852 · ELIMINACIÓN TOTAL de REPS. Decisión de Jelkin (01-10-2026): el REPS no aplica a psicólogos
-- (verificado en la fuente oficial) y nunca se concilió; el flujo correcto es la verificación INTERNA
-- (documentos: registrar -> subir -> aprobar/rechazar), que NO se toca. Se elimina todo el subsistema REPS.
--
-- DESTRUCTIVA A PROPÓSITO (excepción a «migraciones aditivas»): la tabla está VACÍA en producción
-- (VerificacionReps = 0 filas, confirmado por el CEO contra la BD viva) -> DROP sin pérdida de datos.
-- Ninguna PUBLICACIÓN/replicación de BI toca estas tablas (confirmado) -> no repite el incidente spec766.
-- Migración NUEVA (no se re-datan 790/801, ya aplicadas en prod: re-datarlas huérfana el ledger).
--
-- ORDEN FK-safe + dependency-safe (VerificacionReps es HOJA: sus FKs apuntan HACIA PerfilProfesional
-- [Restrict] y Usuario [SetNull]; NADA la referencia, por eso NO hace falta CASCADE):
--   (1) DROP TABLE: arrastra su PK, el CHECK (vigente_exige_vigencia), los 2 FKs, los 2 índices
--       (profesionalId+verificadoEn DESC · GIN de modalidadesNoMapeadas) y el TRIGGER definido SOBRE ella.
--   (2) DROP FUNCTION del trigger (objeto SEPARADO; queda huérfano al irse el trigger -> se puede borrar).
--   (3) DROP TYPE de los 3 enums (solo los usaba esta tabla; el schema ya no los declara).

-- (1)
DROP TABLE "VerificacionReps";

-- (2) El trigger ya se fue con la tabla; la función de inmutabilidad queda sin uso.
DROP FUNCTION "verificacionReps_verificadoEn_inmutable"();

-- (3)
DROP TYPE "EstadoReps";
DROP TYPE "FuenteVerificacionReps";
DROP TYPE "ModalidadReps";
