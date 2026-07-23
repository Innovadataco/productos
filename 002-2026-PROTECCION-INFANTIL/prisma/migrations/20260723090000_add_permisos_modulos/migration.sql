-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'PERMISOS_MODULO_ACTUALIZADOS';

-- CreateTable
CREATE TABLE "ModuloPermisible" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "padreId" TEXT,
    "categoria" TEXT NOT NULL,
    "esCritico" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuloPermisible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoModulo" (
    "id" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermisoModulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuloPermisible_clave_key" ON "ModuloPermisible"("clave");
CREATE INDEX "ModuloPermisible_padreId_idx" ON "ModuloPermisible"("padreId");
CREATE UNIQUE INDEX "PermisoModulo_rol_moduloId_key" ON "PermisoModulo"("rol", "moduloId");
CREATE INDEX "PermisoModulo_rol_idx" ON "PermisoModulo"("rol");

-- AddForeignKey
ALTER TABLE "ModuloPermisible" ADD CONSTRAINT "ModuloPermisible_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "ModuloPermisible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PermisoModulo" ADD CONSTRAINT "PermisoModulo_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloPermisible"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermisoModulo" ADD CONSTRAINT "PermisoModulo_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
