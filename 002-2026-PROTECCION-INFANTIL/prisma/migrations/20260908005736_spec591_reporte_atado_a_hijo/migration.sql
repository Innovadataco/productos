-- SPEC-591 (decisión CEO 06-09-2026): el reporte del padre AUTENTICADO va atado a
-- una ficha «A quién protego» (Hijo) activa. Migración 100 % aditiva:
-- columna nullable + FK con ON DELETE SET NULL (el reporte es evidencia: si el
-- padre borra/inactiva la ficha, el reporte sobrevive desvinculado — una acción
-- sobre la lista del padre no puede destruir la evidencia que ya existía).
ALTER TABLE "Reporte" ADD COLUMN "hijoId" TEXT;

ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "Hijo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Reporte_hijoId_idx" ON "Reporte"("hijoId");
