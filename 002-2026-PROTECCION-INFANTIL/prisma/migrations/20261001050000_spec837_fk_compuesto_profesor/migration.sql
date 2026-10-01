-- SPEC-837 (D-121) · FK COMPUESTO IdentificadorProfesor→Profesor — PR 1 de la cadena de AlertaColegio.
-- Mismo patrón e imposibilidad que 833 (Alumno): ata el `colegioId` denormalizado del identificador al
-- del profesor. Conteo en prod: 0 CON FILAS detrás (CEO) → entra DIRECTO, sin NOT VALID.
--
-- RADIO (medido en el repo; el catálogo VIVO pg_depend/pg_publication/pg_constraint/pg_index/pg_trigger
-- es carril del CEO): sin DROP COLUMN/TABLE (solo DROP del constraint FK simple + ADD de índice y FK);
-- sin triggers en Profesor/IdentificadorProfesor; Profesor está en bi_replica pero NO se dropea columna
-- → la publicación NO se toca. NUNCA CASCADE en DELETE (ON DELETE RESTRICT); ON UPDATE CASCADE = default
-- de Prisma, IGUAL que el FK simple que reemplaza. El índice único (id, colegioId) NO puede fallar por
-- duplicados (id es PK). El tamaño de Profesor en prod lo mide el CEO (#2).
--
-- Las otras dos patas de la cadena (Acudiente, IntegranteComite) NO entran: sus padres NO tienen columna
-- colegioId → excepciones DECLARADAS en el esquema, con el motivo y la distinción de los dos ceros
-- (Acudiente: drift 0 con filas; IntegranteComite: 0 sobre tabla vacía = sin evidencia, re-correr si se puebla).

-- DropForeignKey
ALTER TABLE "IdentificadorProfesor" DROP CONSTRAINT "IdentificadorProfesor_profesorId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_id_colegioId_key" ON "Profesor"("id", "colegioId");

-- AddForeignKey
ALTER TABLE "IdentificadorProfesor" ADD CONSTRAINT "IdentificadorProfesor_profesorId_colegioId_fkey" FOREIGN KEY ("profesorId", "colegioId") REFERENCES "Profesor"("id", "colegioId") ON DELETE RESTRICT ON UPDATE CASCADE;
