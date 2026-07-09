-- CreateTable
CREATE TABLE "DocumentoOficial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sector" TEXT,
    "entidad" TEXT NOT NULL,
    "fechaExpedicion" TIMESTAMP(3),
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
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aiModelId" TEXT,
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'local',
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "modelPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiModelId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentApi" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "submodule" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "docs" TEXT NOT NULL DEFAULT '{}',
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentApi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitaciones" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "estadoId" INTEGER NOT NULL,
    "entidadId" INTEGER,
    "areaIdSala" INTEGER,
    "fechaApertura" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "documentoUrl" TEXT,
    "contenido" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicitacionDocumento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL DEFAULT '',
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "fechaCorte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "licitacionId" TEXT NOT NULL,
    "entidadId" INTEGER,

    CONSTRAINT "LicitacionDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntidadLicitacion" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "nombreOficial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntidadLicitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicitacionStatus" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "nombreOficial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicitacionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoOficial_tipo_idx" ON "DocumentoOficial"("tipo");

-- CreateIndex
CREATE INDEX "DocumentoOficial_jerarquiaNivel_idx" ON "DocumentoOficial"("jerarquiaNivel");

-- CreateIndex
CREATE INDEX "DocumentoOficial_status_idx" ON "DocumentoOficial"("status");

-- CreateIndex
CREATE INDEX "DocumentoOficial_activo_idx" ON "DocumentoOficial"("activo");

-- CreateIndex
CREATE INDEX "AiModel_provider_idx" ON "AiModel"("provider");

-- CreateIndex
CREATE INDEX "AiModel_active_idx" ON "AiModel"("active");

-- CreateIndex
CREATE INDEX "AiModel_scope_idx" ON "AiModel"("scope");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApi_key_key" ON "AgentApi"("key");

-- CreateIndex
CREATE INDEX "AgentApi_module_idx" ON "AgentApi"("module");

-- CreateIndex
CREATE INDEX "AgentApi_submodule_idx" ON "AgentApi"("submodule");

-- CreateIndex
CREATE INDEX "AgentApi_active_idx" ON "AgentApi"("active");

-- CreateIndex
CREATE INDEX "AgentApi_category_idx" ON "AgentApi"("category");

-- CreateIndex
CREATE INDEX "licitaciones_estadoId_idx" ON "licitaciones"("estadoId");

-- CreateIndex
CREATE INDEX "licitaciones_entidadId_idx" ON "licitaciones"("entidadId");

-- CreateIndex
CREATE INDEX "licitaciones_createdAt_idx" ON "licitaciones"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "licitaciones_numero_fechaApertura_key" ON "licitaciones"("numero", "fechaApertura");

-- CreateIndex
CREATE UNIQUE INDEX "LicitacionDocumento_tipo_nombre_licitacionId_key" ON "LicitacionDocumento"("tipo", "nombre", "licitacionId");

-- AddForeignKey
ALTER TABLE "DocumentoOficial" ADD CONSTRAINT "DocumentoOficial_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "DocumentoOficial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitaciones" ADD CONSTRAINT "licitaciones_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "LicitacionStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitaciones" ADD CONSTRAINT "licitaciones_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "EntidadLicitacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicitacionDocumento" ADD CONSTRAINT "LicitacionDocumento_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "licitaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicitacionDocumento" ADD CONSTRAINT "LicitacionDocumento_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "EntidadLicitacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
