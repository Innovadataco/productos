-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "apellidos" TEXT,
ADD COLUMN     "ciudadId" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "paisId" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateIndex
CREATE INDEX "Usuario_paisId_idx" ON "Usuario"("paisId");

-- CreateIndex
CREATE INDEX "Usuario_ciudadId_idx" ON "Usuario"("ciudadId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "Ciudad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
