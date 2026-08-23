-- SPEC-235 (002-PI-135): guías de acción parametrizables por categoría de riesgo.
-- Migración aditiva: enum, tabla, índices e índice único parcial para garantizar
-- una sola guía ACTIVA por categoría.

-- CreateEnum
CREATE TYPE "EstadoGuiaAccion" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION_COMITE', 'ACTIVA', 'REEMPLAZADA');

-- CreateTable
CREATE TABLE "GuiaAccionCategoria" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "versionSecuencial" INTEGER NOT NULL,
    "tituloEmocional" TEXT NOT NULL,
    "subtitulo" TEXT,
    "categoriaBadgeTexto" TEXT NOT NULL,
    "pasosJson" JSONB NOT NULL,
    "calloutTitulo" TEXT,
    "calloutTexto" TEXT,
    "botonesAccionJson" JSONB NOT NULL,
    "piePagina" TEXT,
    "estado" "EstadoGuiaAccion" NOT NULL,
    "aprobadaPorComiteJson" JSONB NOT NULL DEFAULT '[]',
    "creadaPorAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadaEn" TIMESTAMPTZ(6),
    "reemplazadaEn" TIMESTAMPTZ(6),

    CONSTRAINT "GuiaAccionCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuiaAccionCategoria_categoria_estado_idx" ON "GuiaAccionCategoria"("categoria", "estado");

-- CreateIndex
CREATE INDEX "GuiaAccionCategoria_estado_idx" ON "GuiaAccionCategoria"("estado");

-- CreateIndex
CREATE INDEX "GuiaAccionCategoria_creadaPorAdminId_idx" ON "GuiaAccionCategoria"("creadaPorAdminId");

-- AddForeignKey
ALTER TABLE "GuiaAccionCategoria" ADD CONSTRAINT "GuiaAccionCategoria_creadaPorAdminId_fkey" FOREIGN KEY ("creadaPorAdminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice único parcial: solo una guía ACTIVA por categoría.
CREATE UNIQUE INDEX "GuiaAccionCategoria_categoria_activa_key" ON "GuiaAccionCategoria"("categoria") WHERE "estado" = 'ACTIVA';
