-- CreateTable
CREATE TABLE "DocumentoOficial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "fechaExpedicion" DATETIME,
    "numero" TEXT,
    "archivoUrl" TEXT NOT NULL,
    "contenidoTexto" TEXT NOT NULL DEFAULT '',
    "resumen" TEXT NOT NULL DEFAULT '',
    "proposito" TEXT NOT NULL DEFAULT '',
    "actores" TEXT NOT NULL DEFAULT '',
    "motivacion" TEXT NOT NULL DEFAULT '',
    "resuelve" TEXT NOT NULL DEFAULT '',
    "jerarquiaNivel" INTEGER NOT NULL DEFAULT 0,
    "padreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentoOficial_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "DocumentoOficial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentoOficial_tipo_idx" ON "DocumentoOficial"("tipo");

-- CreateIndex
CREATE INDEX "DocumentoOficial_jerarquiaNivel_idx" ON "DocumentoOficial"("jerarquiaNivel");
