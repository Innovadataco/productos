-- SPEC-220 (002-PI-121): dominio Análisis dinero-vs-valor. Migración ADITIVA:
-- solo CREATE TYPE / CREATE TABLE / CREATE INDEX / ALTER TYPE ADD VALUE /
-- ADD CONSTRAINT. Cero DROP, cero ALTER destructivo sobre tablas existentes.

-- Enums nuevos
CREATE TYPE "ModoRegla" AS ENUM ('RECOMIENDA', 'EJECUTA');
CREATE TYPE "EstadoRecomendacion" AS ENUM ('PENDIENTE', 'APLICADA', 'IGNORADA', 'EXPIRADA');

-- Valor aditivo en enum existente
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_SCORE_PURGA';

-- Tabla: score_clientes (snapshot mensual del score de valor por suscripción)
CREATE TABLE "score_clientes" (
    "id" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "componenteReportes" INTEGER NOT NULL DEFAULT 0,
    "componenteCasos" INTEGER NOT NULL DEFAULT 0,
    "componenteAlertas" INTEGER NOT NULL DEFAULT 0,
    "componenteSesiones" INTEGER NOT NULL DEFAULT 0,
    "pesoReportes" DOUBLE PRECISION NOT NULL,
    "pesoCasos" DOUBLE PRECISION NOT NULL,
    "pesoAlertas" DOUBLE PRECISION NOT NULL,
    "pesoSesiones" DOUBLE PRECISION NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "percentilEnCohorte" DOUBLE PRECISION,
    "calculadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_clientes_pkey" PRIMARY KEY ("id")
);

-- Tabla: reglas_recomendacion (estructura; lógica en SPEC-221/224)
CREATE TABLE "reglas_recomendacion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,
    "plantillaRecomendacion" TEXT NOT NULL,
    "modo" "ModoRegla" NOT NULL DEFAULT 'RECOMIENDA',
    "accionEjecutable" TEXT,
    "accionParametros" JSONB,
    "prioridad" INTEGER NOT NULL DEFAULT 50,
    "umbralMinimo" DOUBLE PRECISION,
    "frecuenciaMin" INTEGER NOT NULL DEFAULT 60,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaPorAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reglas_recomendacion_pkey" PRIMARY KEY ("id")
);

-- Tabla: recomendaciones (estructura; lógica en SPEC-221/227)
CREATE TABLE "recomendaciones" (
    "id" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL,
    "sujetoTipo" TEXT,
    "sujetoId" TEXT,
    "datosContexto" JSONB NOT NULL,
    "accionSugerida" TEXT,
    "accionParametros" JSONB,
    "estado" "EstadoRecomendacion" NOT NULL DEFAULT 'PENDIENTE',
    "generadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMPTZ(6),
    "resueltaPorAdminId" TEXT,
    "motivoResolucion" TEXT,
    "expiraEn" TIMESTAMPTZ(6) NOT NULL,
    "ejecutadaAutomatica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "recomendaciones_pkey" PRIMARY KEY ("id")
);

-- Tabla: digest_semanal (estructura; lógica en SPEC-223)
CREATE TABLE "digest_semanal" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "generadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMPTZ(6),
    "top5Decisiones" JSONB NOT NULL,
    "kpisSemana" JSONB NOT NULL,
    "kpisVsPrevia" JSONB NOT NULL,
    "enlacePanel" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "digest_semanal_pkey" PRIMARY KEY ("id")
);

-- Tabla: anomalias (estructura; lógica en SPEC-225)
CREATE TABLE "anomalias" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sujetoTipo" TEXT,
    "sujetoId" TEXT,
    "severidad" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "datosContexto" JSONB NOT NULL,
    "detectadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMPTZ(6),
    "resueltaPorAdminId" TEXT,

    CONSTRAINT "anomalias_pkey" PRIMARY KEY ("id")
);

-- Índices y únicos
CREATE UNIQUE INDEX "score_clientes_suscripcionId_periodo_key" ON "score_clientes"("suscripcionId", "periodo");
CREATE INDEX "score_clientes_periodo_scoreTotal_idx" ON "score_clientes"("periodo", "scoreTotal" DESC);
CREATE UNIQUE INDEX "reglas_recomendacion_clave_key" ON "reglas_recomendacion"("clave");
CREATE INDEX "reglas_recomendacion_activa_prioridad_idx" ON "reglas_recomendacion"("activa", "prioridad" DESC);
CREATE INDEX "recomendaciones_estado_prioridad_generadaEn_idx" ON "recomendaciones"("estado", "prioridad" DESC, "generadaEn" DESC);
CREATE INDEX "recomendaciones_sujetoId_idx" ON "recomendaciones"("sujetoId");
CREATE UNIQUE INDEX "digest_semanal_periodo_destinatarioId_key" ON "digest_semanal"("periodo", "destinatarioId");
CREATE INDEX "anomalias_tipo_detectadaEn_idx" ON "anomalias"("tipo", "detectadaEn" DESC);
CREATE INDEX "anomalias_severidad_detectadaEn_idx" ON "anomalias"("severidad", "detectadaEn" DESC);

-- Llaves foráneas
ALTER TABLE "score_clientes" ADD CONSTRAINT "score_clientes_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reglas_recomendacion" ADD CONSTRAINT "reglas_recomendacion_creadaPorAdminId_fkey" FOREIGN KEY ("creadaPorAdminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recomendaciones" ADD CONSTRAINT "recomendaciones_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_recomendacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recomendaciones" ADD CONSTRAINT "recomendaciones_resueltaPorAdminId_fkey" FOREIGN KEY ("resueltaPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "digest_semanal" ADD CONSTRAINT "digest_semanal_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anomalias" ADD CONSTRAINT "anomalias_resueltaPorAdminId_fkey" FOREIGN KEY ("resueltaPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
