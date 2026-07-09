-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'active',
    "current_phase" TEXT NOT NULL DEFAULT 'initiation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE INDEX "proyectos_current_phase_idx" ON "proyectos"("current_phase");
