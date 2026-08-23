-- SPEC-206 (002-PI-120): tabla de sesiones activas para instrumentación de uso.
-- Aditiva: nuevos enum, valores de audit y tabla. Cero DROP/ALTER destructivo.

CREATE TYPE "MotivoCierreSesion" AS ENUM ('LOGOUT', 'INACTIVIDAD', 'FORZADA');

ALTER TYPE "AccionAudit" ADD VALUE 'SESION_FORZADA_CIERRE';
ALTER TYPE "AccionAudit" ADD VALUE 'SESION_CIERRE_INACTIVIDAD';

CREATE TABLE "sesiones_log" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tenantId" TEXT,
    "rol" "RolUsuario" NOT NULL,
    "iniciadaEn" TIMESTAMPTZ(6) NOT NULL,
    "ultimaActividadEn" TIMESTAMPTZ(6) NOT NULL,
    "cerradaEn" TIMESTAMPTZ(6),
    "motivoCierre" "MotivoCierreSesion",
    "duracionMin" INTEGER,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sesiones_log_usuarioId_iniciadaEn_idx" ON "sesiones_log"("usuarioId", "iniciadaEn" DESC);
CREATE INDEX "sesiones_log_tenantId_iniciadaEn_idx" ON "sesiones_log"("tenantId", "iniciadaEn" DESC);
CREATE INDEX "sesiones_log_cerradaEn_ultimaActividadEn_idx" ON "sesiones_log"("cerradaEn", "ultimaActividadEn");
CREATE INDEX "sesiones_log_creadoEn_idx" ON "sesiones_log"("creadoEn");

ALTER TABLE "sesiones_log" ADD CONSTRAINT "sesiones_log_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
