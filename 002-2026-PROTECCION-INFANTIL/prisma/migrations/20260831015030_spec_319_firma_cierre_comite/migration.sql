-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_COMITE_INVITACION_REENVIADA';

-- AlterTable
ALTER TABLE "SolicitudComite" ADD COLUMN     "integranteFirmanteId" TEXT;

-- CreateIndex
CREATE INDEX "SolicitudComite_integranteFirmanteId_idx" ON "SolicitudComite"("integranteFirmanteId");

-- AddForeignKey
ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_integranteFirmanteId_fkey" FOREIGN KEY ("integranteFirmanteId") REFERENCES "IntegranteComite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
