-- Cronograma, presupuesto, recursos y lecciones (spec 008, US4/US5/US6).
--
-- ESTRICTAMENTE ADITIVA: cuatro tablas nuevas y nada más. No altera `proyectos`
-- ni ninguna tabla existente, no relaja restricciones y no toca datos. Misma
-- clase de riesgo que la migración de entregables, y se ensaya igual en BD
-- desechable antes de la viva (D-039).

-- US4 · Cronograma (FR-011)
CREATE TABLE "hitos_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hitos_proyecto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hitos_proyecto_proyectoId_idx" ON "hitos_proyecto"("proyectoId");
ALTER TABLE "hitos_proyecto"
  ADD CONSTRAINT "hitos_proyecto_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- US5 · Presupuesto con control de gasto (FR-012)
CREATE TABLE "partidas_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "montoPlaneado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "montoEjecutado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partidas_proyecto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partidas_proyecto_proyectoId_idx" ON "partidas_proyecto"("proyectoId");
ALTER TABLE "partidas_proyecto"
  ADD CONSTRAINT "partidas_proyecto_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- US5 · Recursos (FR-013)
CREATE TABLE "recursos_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'humano',
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "disponibilidad" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recursos_proyecto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recursos_proyecto_proyectoId_idx" ON "recursos_proyecto"("proyectoId");
ALTER TABLE "recursos_proyecto"
  ADD CONSTRAINT "recursos_proyecto_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- US6 · Lecciones aprendidas (FR-014)
CREATE TABLE "lecciones_aprendidas" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT '',
    "impacto" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lecciones_aprendidas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lecciones_aprendidas_proyectoId_idx" ON "lecciones_aprendidas"("proyectoId");
ALTER TABLE "lecciones_aprendidas"
  ADD CONSTRAINT "lecciones_aprendidas_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
