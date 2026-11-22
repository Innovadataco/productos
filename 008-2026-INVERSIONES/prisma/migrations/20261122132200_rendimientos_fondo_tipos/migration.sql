-- Rendimientos del fondo (frente fondo-rendimientos): la categoría de caja del rendimiento del FIC pagado en efectivo
-- (RENDIMIENTO_FIC: entra a la caja; no es un aporte ni un interés de la caja) y el tipo de fuente del CSV del dueño con
-- los rendimientos y su retención (REGISTRO_RENDIMIENTOS_FIC). Van solos, en su propia migración, como en C1: un valor
-- nuevo de un enum no se puede usar en la misma transacción en que nace, y la migración siguiente
-- (20261122132300_rendimientos_fondo) los usa en un CHECK y en un disparador.
-- AlterEnum
ALTER TYPE "CategoriaAjusteCaja" ADD VALUE 'RENDIMIENTO_FIC';

-- AlterEnum
ALTER TYPE "TipoFuente" ADD VALUE 'REGISTRO_RENDIMIENTOS_FIC';
