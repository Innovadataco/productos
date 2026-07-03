/*
  Warnings:

  - You are about to drop the column `country` on the `AiModel` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'local',
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "modelPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiModel" ("active", "apiKey", "baseUrl", "config", "createdAt", "id", "modelPath", "name", "provider", "updatedAt") SELECT "active", "apiKey", "baseUrl", "config", "createdAt", "id", "modelPath", "name", "provider", "updatedAt" FROM "AiModel";
DROP TABLE "AiModel";
ALTER TABLE "new_AiModel" RENAME TO "AiModel";
CREATE INDEX "AiModel_provider_idx" ON "AiModel"("provider");
CREATE INDEX "AiModel_active_idx" ON "AiModel"("active");
CREATE INDEX "AiModel_scope_idx" ON "AiModel"("scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
