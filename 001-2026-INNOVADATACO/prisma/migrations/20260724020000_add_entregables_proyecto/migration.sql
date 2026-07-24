-- Entregables de proyecto (spec 008, US3 / FR-009).
--
-- Migración ESTRICTAMENTE ADITIVA: crea una tabla nueva y nada más. No altera
-- `proyectos` ni ninguna otra tabla existente, no relaja restricciones y no
-- toca datos. Es la clase de migración con menor riesgo posible sobre una BD
-- viva, y aun así se ensaya antes en BD desechable con conteo antes/después
-- (D-039), porque el criterio no depende de lo fácil que parezca.

CREATE TABLE "entregables" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "avance" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fechaCompromiso" TIMESTAMP(3),
    "responsable" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entregables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entregables_proyectoId_idx" ON "entregables"("proyectoId");

-- CASCADE (FR-002): borrar un proyecto se lleva sus entregables, sin huérfanos.
ALTER TABLE "entregables"
  ADD CONSTRAINT "entregables_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
