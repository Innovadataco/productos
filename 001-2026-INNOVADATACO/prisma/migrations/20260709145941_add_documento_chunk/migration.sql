-- CreateTable
CREATE TABLE "DocumentoChunk" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoChunk_documentoId_idx" ON "DocumentoChunk"("documentoId");

-- CreateIndex
CREATE INDEX "DocumentoChunk_embedding_idx" ON "DocumentoChunk"("embedding");

-- AddForeignKey
ALTER TABLE "DocumentoChunk" ADD CONSTRAINT "DocumentoChunk_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
