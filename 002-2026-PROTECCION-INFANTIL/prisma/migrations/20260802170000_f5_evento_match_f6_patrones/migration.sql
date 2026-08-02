-- SPEC-139 (F5) + SPEC-142 (F6): migración ADITIVA — dos tablas nuevas y una
-- columna nullable. Cero cambios destructivos, cero backfill.

-- CreateTable
CREATE TABLE "eventos_match" (
    "id" TEXT NOT NULL,
    "identificadorId" TEXT NOT NULL,
    "reporteNuevoId" TEXT NOT NULL,
    "conteoAcumulado" INTEGER NOT NULL,
    "ciudades" TEXT[],
    "conductasCoincidentes" TEXT[],
    "interCiudad" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrones_institucionales" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "conducta" "CategoriaConducta" NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "conteo" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrones_institucionales_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AlertaColegio" ADD COLUMN "patronInstitucionalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "eventos_match_reporteNuevoId_key" ON "eventos_match"("reporteNuevoId");

-- CreateIndex
CREATE INDEX "eventos_match_identificadorId_idx" ON "eventos_match"("identificadorId");

-- CreateIndex
CREATE INDEX "eventos_match_interCiudad_idx" ON "eventos_match"("interCiudad");

-- CreateIndex
CREATE INDEX "eventos_match_creadoEn_idx" ON "eventos_match"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "patrones_institucionales_colegioId_periodo_grado_conducta__key" ON "patrones_institucionales"("colegioId", "periodo", "grado", "conducta", "plataformaId");

-- CreateIndex
CREATE INDEX "patrones_institucionales_colegioId_periodo_idx" ON "patrones_institucionales"("colegioId", "periodo");

-- CreateIndex
CREATE INDEX "AlertaColegio_patronInstitucionalId_idx" ON "AlertaColegio"("patronInstitucionalId");

-- AddForeignKey
ALTER TABLE "eventos_match" ADD CONSTRAINT "eventos_match_identificadorId_fkey" FOREIGN KEY ("identificadorId") REFERENCES "IdentificadorReportado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_match" ADD CONSTRAINT "eventos_match_reporteNuevoId_fkey" FOREIGN KEY ("reporteNuevoId") REFERENCES "Reporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrones_institucionales" ADD CONSTRAINT "patrones_institucionales_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrones_institucionales" ADD CONSTRAINT "patrones_institucionales_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_patronInstitucionalId_fkey" FOREIGN KEY ("patronInstitucionalId") REFERENCES "patrones_institucionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
