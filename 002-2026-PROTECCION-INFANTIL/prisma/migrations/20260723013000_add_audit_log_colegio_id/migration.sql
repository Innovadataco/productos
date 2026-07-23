-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "colegioId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_colegioId_idx" ON "AuditLog"("colegioId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
