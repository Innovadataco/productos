-- SPEC-801 · modalidadesNoMapeadas: los valores CRUDOS del REPS que NO supimos traducir a ModalidadReps.
-- Aditiva. Es dato de la AUTORIDAD (string tal como vino), no interpretación nuestra. La compuerta sigue
-- NEGANDO ante una modalidad sin mapear (fail-closed); esta columna NO abre la compuerta — la hace
-- AUDITABLE: permite DESCUBRIR después «qué llegó sin traducir y a cuántos profesionales afectó»
-- (consulta en src/lib/profesional/modalidades-reps-no-mapeadas.ts). GIN para agrupar/filtrar por el valor crudo.

-- AlterTable
ALTER TABLE "VerificacionReps" ADD COLUMN     "modalidadesNoMapeadas" TEXT[];

-- CreateIndex
CREATE INDEX "VerificacionReps_modalidadesNoMapeadas_idx" ON "VerificacionReps" USING GIN ("modalidadesNoMapeadas");
