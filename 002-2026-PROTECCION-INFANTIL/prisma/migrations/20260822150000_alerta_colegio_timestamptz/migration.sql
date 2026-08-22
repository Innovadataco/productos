-- SPEC-200 deuda técnica (cierra I-102): AlertaColegio debe usar Timestamptz(6)
-- para que cálculos timezone-awares (reloj24h en hora Bogotá) sean deterministas
-- en CI/Review Apps donde la BD aún tenía TIMESTAMP(3) without time zone.
-- Migración aditiva pura: solo ALTER COLUMN ... TYPE, cero DROP.
ALTER TABLE "AlertaColegio"
    ALTER COLUMN "creadoEn" SET DATA TYPE TIMESTAMPTZ(6),
    ALTER COLUMN "actualizadoEn" SET DATA TYPE TIMESTAMPTZ(6),
    ALTER COLUMN "vencimientoSla" SET DATA TYPE TIMESTAMPTZ(6);
