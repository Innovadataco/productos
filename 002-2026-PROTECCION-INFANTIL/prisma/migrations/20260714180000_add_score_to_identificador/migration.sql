-- AlterTable
ALTER TABLE "IdentificadorReportado" ADD COLUMN     "nivelRiesgo" TEXT,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "IdentificadorReportado_score_idx" ON "IdentificadorReportado"("score");
