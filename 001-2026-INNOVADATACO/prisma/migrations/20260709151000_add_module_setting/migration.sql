-- CreateTable
CREATE TABLE "ModuleSetting" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleSetting_module_settingKey_key" ON "ModuleSetting"("module", "settingKey");

-- CreateIndex
CREATE INDEX "ModuleSetting_module_idx" ON "ModuleSetting"("module");

-- CreateIndex
CREATE INDEX "ModuleSetting_settingKey_idx" ON "ModuleSetting"("settingKey");

-- AddForeignKey
ALTER TABLE "ModuleSetting" ADD CONSTRAINT "ModuleSetting_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
