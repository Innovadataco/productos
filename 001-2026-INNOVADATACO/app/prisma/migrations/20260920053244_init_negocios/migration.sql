-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "tipo" TEXT NOT NULL,
    "contacto" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "entidad_contratante" TEXT NOT NULL,
    "fecha_inicio_planeada" TIMESTAMP(3),
    "fecha_fin_planeada" TIMESTAMP(3),
    "valor_estimado" DECIMAL(15,2),
    "alcance" TEXT,
    "estado" TEXT NOT NULL,
    "motivo_cierre" TEXT,
    "comentario_cierre" TEXT,
    "clienteId" TEXT,
    "responsableId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio_real" TIMESTAMP(3),
    "fecha_entrega_planeada" TIMESTAMP(3),
    "fecha_entrega_real" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "valor_contratado" DECIMAL(15,2),
    "alcance" TEXT,
    "oportunidad_id" TEXT,
    "clienteId" TEXT NOT NULL,
    "responsableId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hitos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "proyectoId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "archivo_original" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanio_bytes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "oportunidadId" TEXT,
    "proyectoId" TEXT,
    "subido_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_nit_key" ON "clientes"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidades_codigo_key" ON "oportunidades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_oportunidad_id_key" ON "proyectos"("oportunidad_id");

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_oportunidad_id_fkey" FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitos" ADD CONSTRAINT "hitos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
