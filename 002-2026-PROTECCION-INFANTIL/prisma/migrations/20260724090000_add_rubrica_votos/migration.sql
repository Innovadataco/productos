-- CreateTable (aditiva, spec 090: matriz categoría × modelo × 0/1 de la rúbrica)
CREATE TABLE "clasificacion_rubrica_votos" (
    "id" TEXT NOT NULL,
    "clasificacionIAId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "cumple" BOOLEAN NOT NULL,
    "preguntasJson" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clasificacion_rubrica_votos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clasificacion_rubrica_votos_clasificacionIAId_idx" ON "clasificacion_rubrica_votos"("clasificacionIAId");

-- AddForeignKey
ALTER TABLE "clasificacion_rubrica_votos" ADD CONSTRAINT "clasificacion_rubrica_votos_clasificacionIAId_fkey" FOREIGN KEY ("clasificacionIAId") REFERENCES "ClasificacionIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;
