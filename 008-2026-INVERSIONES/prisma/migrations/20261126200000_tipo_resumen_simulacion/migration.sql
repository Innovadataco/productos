-- Simulación con IA (frente B, B1): el tipo de resumen SIMULACION, la explicación de /operar. Va SOLO, en su propia
-- migración: `prisma migrate deploy` corre cada migration.sql en una transacción y, en PostgreSQL 16, un valor nuevo de un
-- enum no se puede usar en la transacción que lo agrega. Lo que lo use (las CHECK de config_ia en la migración siguiente,
-- 20261126200100_config_ia_simulacion, y el código) va después. Precedente: 20261122030000_datos_oficiales_tipos.
-- Candado: tests/unit/ia/registro/migracion-simulacion.test.ts.
-- AlterEnum
ALTER TYPE "TipoResumenIa" ADD VALUE 'SIMULACION';
