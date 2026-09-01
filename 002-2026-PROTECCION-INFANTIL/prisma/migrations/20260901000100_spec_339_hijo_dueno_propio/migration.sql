-- SPEC-339 (A-67 · D-4) · el menor pasa a tener padre propio.
--
-- Regla de Jelkin (31-08-2026): "si otro padre se registra con un correo
-- diferente y quiere vincular los mismos hijos, no pasa absolutamente nada".
-- Cada padre tiene su lista, sus interruptores y sus avisos, independientes.
--
-- Antes: la ficha del menor era global y única por documento en TODO el sistema;
-- dos padres compartían la misma fila. Consecuencias verificadas en fuente:
-- el interruptor del menor era compartido, el de cada identificador también, y
-- corregir los datos le reescribía la ficha al otro padre.
--
-- Habilitada por el conteo en producción del 31-08-2026: 0 menores con más de un
-- padre. Por eso esta migración NO clona ninguna fila. Si ese supuesto ya no es
-- cierto cuando corra, ABORTA EN VOZ ALTA: partir fichas de PII de menores con
-- avisos ya emitidos es trabajo de otra spec, no de un backfill silencioso.

-- 1. Columna nullable para poder rellenar.
ALTER TABLE "Hijo" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

-- 2. Guarda A · ningún menor puede tener más de un padre.
DO $$
DECLARE compartidos INTEGER;
BEGIN
    SELECT COUNT(*) INTO compartidos
    FROM (SELECT "hijoId" FROM "HijoPadre" GROUP BY "hijoId" HAVING COUNT(*) > 1) AS x;

    IF compartidos > 0 THEN
        RAISE EXCEPTION
            'SPEC-339 ABORTA: % menor(es) con mas de un padre vinculado. El supuesto de D-4 (0 compartidos) ya no se cumple. Partir esas fichas es trabajo de una spec propia; NO se resuelve con este backfill.',
            compartidos;
    END IF;
END $$;

-- 3. Relleno desde el puente (hoy 1 a 1: no se duplica ni una fila).
UPDATE "Hijo" h
SET "usuarioId" = hp."usuarioId"
FROM "HijoPadre" hp
WHERE hp."hijoId" = h."id" AND h."usuarioId" IS NULL;

-- 4. Guarda B · ningún menor puede quedarse sin dueño. Una ficha huérfana (0
--    padres) es PII sin responsable: no se borra en silencio, se escala.
DO $$
DECLARE huerfanos INTEGER;
BEGIN
    SELECT COUNT(*) INTO huerfanos FROM "Hijo" WHERE "usuarioId" IS NULL;

    IF huerfanos > 0 THEN
        RAISE EXCEPTION
            'SPEC-339 ABORTA: % ficha(s) de menor sin ningun padre vinculado. Son datos personales de un menor sin responsable: decide un humano si se reasignan o se eliminan, no esta migracion.',
            huerfanos;
    END IF;
END $$;

-- 5. Dueño obligatorio, con borrado en cascada. Sin la cascada, borrar un padre
--    falla por clave foránea y rompe `scripts/limpieza/borrar-padre.ts`, que
--    borra tabla por tabla (mismo defecto que A-65).
ALTER TABLE "Hijo" ALTER COLUMN "usuarioId" SET NOT NULL;

ALTER TABLE "Hijo" DROP CONSTRAINT IF EXISTS "Hijo_usuarioId_fkey";
ALTER TABLE "Hijo" ADD CONSTRAINT "Hijo_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. La unicidad del documento deja de ser global y pasa a ser por padre.
--    OJO: Prisma materializó esa unicidad como INDICE UNICO, no como constraint
--    de tabla. Un `DROP CONSTRAINT IF EXISTS` solo, sin el `DROP INDEX`, es un
--    NO-OP SILENCIOSO: la migracion pasa en verde y la unicidad global sigue
--    viva, con lo que el segundo padre no podria registrar al mismo menor y D-4
--    no funcionaria. Se hacen las dos, y la guarda C de abajo lo verifica.
ALTER TABLE "Hijo" DROP CONSTRAINT IF EXISTS "Hijo_documentoTipo_documentoNumero_key";
DROP INDEX IF EXISTS "Hijo_documentoTipo_documentoNumero_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Hijo_usuarioId_documentoTipo_documentoNumero_key"
    ON "Hijo"("usuarioId", "documentoTipo", "documentoNumero");

CREATE INDEX IF NOT EXISTS "Hijo_usuarioId_idx" ON "Hijo"("usuarioId");

-- 7. Guarda C · verificar el resultado, no confiar en que los DROP hicieron algo.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'Hijo' AND indexname = 'Hijo_documentoTipo_documentoNumero_key'
    ) THEN
        RAISE EXCEPTION
            'SPEC-339 ABORTA: la unicidad GLOBAL del documento del menor sigue viva. Sin retirarla, dos padres no pueden tener al mismo menor y D-4 no funciona.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'Hijo' AND indexname = 'Hijo_usuarioId_documentoTipo_documentoNumero_key'
    ) THEN
        RAISE EXCEPTION
            'SPEC-339 ABORTA: falta la unicidad POR PADRE del documento del menor.';
    END IF;
END $$;
