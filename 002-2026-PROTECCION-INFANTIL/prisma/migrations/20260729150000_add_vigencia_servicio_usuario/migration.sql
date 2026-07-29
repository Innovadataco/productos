-- SPEC-119: ventana de servicio por cliente (padres). Aditiva: ambas columnas nullable,
-- null = sin vigencia definida = acceso permitido (nadie se corta por omisión del dato).
ALTER TABLE "Usuario" ADD COLUMN "inicioServicio" TIMESTAMP(3),
ADD COLUMN "finServicio" TIMESTAMP(3);
