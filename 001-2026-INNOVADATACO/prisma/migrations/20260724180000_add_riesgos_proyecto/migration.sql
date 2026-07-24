-- Riesgos de proyecto (spec 014, US3 / FR-004).
--
-- ESTRICTAMENTE ADITIVA: una tabla nueva y nada más. No altera `proyectos` ni
-- ninguna tabla existente, no relaja restricciones, no toca datos. Ensayada en
-- BD desechable con conteo antes/después antes de la viva (D-039).

CREATE TABLE "riesgos_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "probabilidad" TEXT NOT NULL DEFAULT 'media',
    "impacto" TEXT NOT NULL DEFAULT 'medio',
    "mitigacion" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "riesgos_proyecto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "riesgos_proyecto_proyectoId_idx" ON "riesgos_proyecto"("proyectoId");

-- CASCADE (FR-004): borrar un proyecto se lleva sus riesgos, sin huérfanos.
ALTER TABLE "riesgos_proyecto"
  ADD CONSTRAINT "riesgos_proyecto_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
