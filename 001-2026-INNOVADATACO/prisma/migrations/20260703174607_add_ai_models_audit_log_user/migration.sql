-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "modelPath" TEXT NOT NULL,
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiModelId" TEXT,
    CONSTRAINT "AuditLog_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentoOficial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sector" TEXT,
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
    "status" TEXT NOT NULL DEFAULT 'pending',
    "aiModelId" TEXT,
    "processingError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentoOficial_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "DocumentoOficial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentoOficial" ("actores", "archivoUrl", "contenidoTexto", "createdAt", "entidad", "fechaExpedicion", "id", "jerarquiaNivel", "motivacion", "numero", "padreId", "proposito", "resuelve", "resumen", "sector", "tipo", "titulo", "updatedAt") SELECT "actores", "archivoUrl", "contenidoTexto", "createdAt", "entidad", "fechaExpedicion", "id", "jerarquiaNivel", "motivacion", "numero", "padreId", "proposito", "resuelve", "resumen", "sector", "tipo", "titulo", "updatedAt" FROM "DocumentoOficial";
DROP TABLE "DocumentoOficial";
ALTER TABLE "new_DocumentoOficial" RENAME TO "DocumentoOficial";
CREATE INDEX "DocumentoOficial_tipo_idx" ON "DocumentoOficial"("tipo");
CREATE INDEX "DocumentoOficial_jerarquiaNivel_idx" ON "DocumentoOficial"("jerarquiaNivel");
CREATE INDEX "DocumentoOficial_status_idx" ON "DocumentoOficial"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiModel_provider_idx" ON "AiModel"("provider");

-- CreateIndex
CREATE INDEX "AiModel_active_idx" ON "AiModel"("active");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
