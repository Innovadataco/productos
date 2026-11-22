-- Datos oficiales (fase C, C1): el tipo de fuente del registro de decretos que carga el dueño por la vía B (C4a). Va
-- solo, en su propia migración: un valor nuevo de un enum no se puede usar en la misma transacción en que nace, y así
-- la migración siguiente (20261122030100_datos_oficiales) o una posterior pueden usarlo sin riesgo. La información
-- relevante (P2) queda fuera: no hay REGISTRO_RELEVANTE.
-- AlterEnum
ALTER TYPE "TipoFuente" ADD VALUE 'REGISTRO_DECRETOS';
