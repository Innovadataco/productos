-- SPEC-109 (D-34): elimina el módulo de apelación. La tabla está verificada VACÍA en
-- producción (PASO 0, 2026-07-28), y esta migración lleva la guarda DENTRO (corrección
-- ZEUS 002-PI-034): si aparece cualquier fila, ABORTA sin borrar nada.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "ApelacionIdentificador") THEN
        RAISE EXCEPTION 'SPEC-109: hay apelaciones registradas. Abortar y avisar a ZEUS.';
    END IF;
END $$;

-- DropTable
DROP TABLE "ApelacionIdentificador";

-- DropEnum
DROP TYPE "EstadoApelacion";
